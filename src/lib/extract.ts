import * as cheerio from 'cheerio'

export interface ExtractionResult {
  text: string
  title: string
  sourceType: 'youtube' | 'article' | 'twitter' | 'unknown'
  reason?: string  // human-readable failure reason
}

export function validateUrl(url: string): { valid: true } | { valid: false; reason: string } {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return { valid: false, reason: 'URL inválida' }
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { valid: false, reason: 'Solo se permiten URLs https' }
  }

  const hostname = parsedUrl.hostname.toLowerCase()
  const ipMatch = hostname.match(/^\[([^\]]+)\]$/)
  const rawHost = ipMatch ? ipMatch[1] : hostname

  // IPv4 private ranges + loopback + cloud metadata
  if (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' ||
    hostname.startsWith('10.') ||
    hostname.match(/^172\.(1[6-9]|2\d|3[01])\./) ||
    hostname.startsWith('192.168.') ||
    hostname.includes('metadata') || hostname.includes('internal') || hostname.includes('local')
  ) {
    return { valid: false, reason: 'Solo se permiten URLs públicas' }
  }

  // IPv6 private ranges
  if (
    rawHost === '::1' || rawHost === '::' ||
    rawHost.startsWith('fd') || rawHost.startsWith('fc') ||  // ULA fd00::/8
    rawHost.startsWith('fe80:') || rawHost.startsWith('fe81:') || // link-local
    rawHost.match(/^fe[89ab][0-9a-f]:/i) // broader link-local fe80::/10
  ) {
    return { valid: false, reason: 'Solo se permiten URLs públicas' }
  }

  // Cloud metadata IPs
  const ipv4Octets = hostname.split('.').map(Number)
  if (ipv4Octets.length === 4 && !ipv4Octets.some(isNaN)) {
    // 169.254.0.0/16 (link-local, includes AWS/GCP/Azure metadata)
    if (ipv4Octets[0] === 169 && ipv4Octets[1] === 254) {
      return { valid: false, reason: 'Solo se permiten URLs públicas' }
    }
    // Also block 100.64.0.0/10 (CGNAT, used by some internal infra)
    if (ipv4Octets[0] === 100 && ipv4Octets[1] >= 64 && ipv4Octets[1] <= 127) {
      return { valid: false, reason: 'Solo se permiten URLs públicas' }
    }
  }

  return { valid: true }
}

export async function extractFromUrl(url: string): Promise<ExtractionResult> {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return extractYouTube(url)
  }
  if (url.includes('twitter.com') || url.includes('x.com')) {
    return extractTwitter(url)
  }
  return extractArticle(url)
}

async function extractYouTube(url: string): Promise<ExtractionResult> {
  try {
    const { YoutubeTranscript } = await import('youtube-transcript')
    const videoId = extractYouTubeId(url)
    if (!videoId || videoId.length > 11 || !videoId.match(/^[a-zA-Z0-9_-]+$/)) {
      return { text: '', title: '', sourceType: 'youtube', reason: 'No se pudo identificar el ID del video.' }
    }
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'es' })
    const text = transcript.map(t => t.text).join(' ')
    return { text, title: `YouTube video (${videoId})`, sourceType: 'youtube' }
  } catch (e: any) {
    // Try fallback — any language
    try {
      const { YoutubeTranscript } = await import('youtube-transcript')
      const videoId = extractYouTubeId(url)
      const transcript = await YoutubeTranscript.fetchTranscript(videoId)
      const text = transcript.map(t => t.text).join(' ')
      return { text, title: `YouTube video (${videoId})`, sourceType: 'youtube' }
    } catch (fallbackErr: any) {
      const msg = fallbackErr?.message?.toLowerCase() || ''
      if (msg.includes('disabled') || msg.includes('caption') || msg.includes('transcript')) {
        return {
          text: '', title: '', sourceType: 'youtube',
          reason: 'Este video no tiene subtítulos disponibles. Prueba con otro video que tenga subtítulos activados o pega el texto manualmente.'
        }
      }
      return { text: '', title: '', sourceType: 'youtube', reason: 'Error al extraer el transcript de YouTube. Verifica que la URL sea correcta.' }
    }
  }
}

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:v=|\/v\/|youtu\.be\/|embed\/)([^&?/\s]+)/)
  return match ? match[1] : url
}

async function extractTwitter(url: string): Promise<ExtractionResult> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nomemientas/1.0)' },
      redirect: 'manual',
    })
    if (!res.ok && res.status >= 300 && res.status < 400) {
      // Redirect — validate the new location before following
      const location = res.headers.get('location')
      if (location) {
        const locUrl = new URL(location, url).href
        const validation = validateUrl(locUrl)
        if (!validation.valid) {
          return { text: '', title: '', sourceType: 'twitter', reason: 'La URL redirige a un destino no permitido.' }
        }
        return extractTwitter(locUrl)
      }
    }
    if (!res.ok) return { text: '', title: '', sourceType: 'twitter', reason: 'Twitter no está disponible o la URL no es correcta.' }
    const rawHtml = await res.text()
    const cleanHtml = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    const $ = cheerio.load(cleanHtml)
    const metaDesc = $('meta[name="description"]').attr('content')
    const ogDesc = $('meta[property="og:description"]').attr('content')
    const scriptData = $('script[type="application/ld+json"]').first().text()
    let textFromJson = ''
    if (scriptData) {
      try {
        const data = JSON.parse(scriptData)
        textFromJson = data.text || data.articleBody || ''
      } catch {}
    }
    const text = textFromJson || ogDesc || metaDesc || ''
    const title = ogDesc || metaDesc || ''
    if (!text) return { text: '', title: '', sourceType: 'twitter', reason: 'No se pudo extraer el contenido del tuit. Prueba a pegar el texto directamente.' }
    return { text: cleanText(text), title, sourceType: 'twitter' }
  } catch {
    return { text: '', title: '', sourceType: 'twitter', reason: 'Error al acceder a Twitter. Prueba a pegar el texto directamente.' }
  }
}

async function extractArticle(url: string): Promise<ExtractionResult> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nomemientas/1.0)' },
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok && res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (location) {
        const locUrl = new URL(location, url).href
        const validation = validateUrl(locUrl)
        if (!validation.valid) {
          return { text: '', title: '', sourceType: 'article', reason: 'La URL redirige a un destino no permitido.' }
        }
        return extractArticle(locUrl)
      }
    }
    if (!res.ok) return { text: '', title: '', sourceType: 'article', reason: `No se pudo acceder al artículo (error ${res.status}). Verifica que la URL sea correcta.` }
    const contentLength = res.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      return { text: '', title: '', sourceType: 'article', reason: 'El artículo es demasiado grande para procesarlo.' }
    }
    const rawHtml = await res.text()
    const cleanHtml = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    const $ = cheerio.load(cleanHtml)
    $('nav, header, footer, .ad, .ads, .sidebar, .comments, .share, .related').remove()
    const articleSelector = 'article, .article-body, .post-content, .entry-content, .content, main, .main-content, [role="main"]'
    let body = $(articleSelector).text()
    if (!body || body.length < 100) {
      body = $('p').map((_, el) => $(el).text()).get().join('\n\n')
    }
    if (!body || body.length < 50) {
      return { text: '', title: '', sourceType: 'article', reason: 'No se pudo extraer el contenido del artículo. Prueba a pegar el texto directamente.' }
    }
    const title = $('meta[property="og:title"]').attr('content') ||
                  $('title').text() ||
                  $('h1').first().text()
    return {
      text: cleanText(body),
      title: cleanText(title),
      sourceType: 'article',
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { text: '', title: '', sourceType: 'unknown', reason: 'La extracción del artículo tardó demasiado. Prueba a pegar el texto directamente.' }
    }
    return { text: '', title: '', sourceType: 'unknown', reason: 'Error al acceder al artículo. Verifica la URL o pega el texto directamente.' }
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}
