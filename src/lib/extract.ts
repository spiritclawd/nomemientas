import * as cheerio from 'cheerio'

// Blocklist: only allow known, safe domains for article extraction
// Anything not matching these patterns is rejected at the route level
const ALLOWED_ARTICLE_DOMAINS = [
  'elpais.com',
  'elmundo.es',
  'rtve.es',
  'lavanguardia.com',
  '20minutos.es',
  'eldiario.es',
  'okdiario.com',
  'abc.es',
  'elespanol.com',
  'publico.es',
  'confilegal.com',
  'expansion.com',
  'econfdencial.com',
  'vozpopuli.com',
  'elconfidencial.com',
  'youtube.com',
  'youtu.be',
  'twitter.com',
  'x.com',
]

export interface ExtractionResult {
  text: string
  title: string
  sourceType: 'youtube' | 'article' | 'twitter' | 'unknown'
}

export function validateUrl(url: string): { valid: true } | { valid: false; reason: string } {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return { valid: false, reason: 'URL inválida' }
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { valid: false, reason: 'Solo se permiten URLs https' }
  }

  // Block localhost, 127.x, 10.x, 172.16-31.x, 192.168.x - SSRF prevention
  const hostname = parsedUrl.hostname.toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('10.') ||
    hostname.match(/^172\.(1[6-9]|2\d|3[01])\./) ||
    hostname.startsWith('192.168.') ||
    hostname.includes('local') ||
    hostname.includes('metadata') ||
    hostname.includes('internal')
  ) {
    return { valid: false, reason: 'Solo se permiten URLs públicas' }
  }

  // Check domain allowlist
  const domain = hostname.replace('www.', '')
  const isAllowed = ALLOWED_ARTICLE_DOMAINS.some(allowed => domain === allowed || domain.endsWith('.' + allowed))
  if (!isAllowed) {
    return { valid: false, reason: 'Dominio no soportado actualmente. Pega el texto directamente.' }
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
      return { text: '', title: '', sourceType: 'youtube' }
    }
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'es' })
    const text = transcript.map(t => t.text).join(' ')
    return {
      text,
      title: `YouTube video (${videoId})`,
      sourceType: 'youtube',
    }
  } catch {
    try {
      const { YoutubeTranscript } = await import('youtube-transcript')
      const videoId = extractYouTubeId(url)
      const transcript = await YoutubeTranscript.fetchTranscript(videoId)
      const text = transcript.map(t => t.text).join(' ')
      return { text, title: `YouTube video (${videoId})`, sourceType: 'youtube' }
    } catch {
      return { text: '', title: '', sourceType: 'youtube' }
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
      redirect: 'follow',
    })
    if (!res.ok) return { text: '', title: '', sourceType: 'twitter' }

    const rawHtml = await res.text()
    // Strip ALL script/style tags before parsing - XSS defense
    const cleanHtml = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
                              .replace(/<style[\s\S]*?<\/style>/gi, '')
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

    return { text: cleanText(text), title, sourceType: 'twitter' }
  } catch {
    return { text: '', title: '', sourceType: 'twitter' }
  }
}

async function extractArticle(url: string): Promise<ExtractionResult> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nomemientas/1.0)' },
      redirect: 'follow',
    })
    if (!res.ok) return { text: '', title: '', sourceType: 'article' }

    // Cap response at 2MB to prevent memory abuse
    const contentLength = res.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) {
      return { text: '', title: '', sourceType: 'article' }
    }

    const rawHtml = await res.text()
    // Strip script/style before cheerio parse - XSS defense
    const cleanHtml = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
                              .replace(/<style[\s\S]*?<\/style>/gi, '')
    const $ = cheerio.load(cleanHtml)

    // Remove noise elements
    $('nav, header, footer, .ad, .ads, .sidebar, .comments, .share, .related').remove()

    // Try article content selectors
    const articleSelector = 'article, .article-body, .post-content, .entry-content, .content, main, .main-content, [role="main"]'
    let body = $(articleSelector).text()

    if (!body || body.length < 100) {
      body = $('p').map((_, el) => $(el).text()).get().join('\n\n')
    }

    const title = $('meta[property="og:title"]').attr('content') ||
                  $('title').text() ||
                  $('h1').first().text()

    return {
      text: cleanText(body),
      title: cleanText(title),
      sourceType: 'article',
    }
  } catch {
    return { text: '', title: '', sourceType: 'unknown' }
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
