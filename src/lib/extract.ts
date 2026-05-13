import * as cheerio from 'cheerio'

export interface ExtractionResult {
  text: string
  title: string
  sourceType: 'youtube' | 'article' | 'twitter' | 'unknown'
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
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'es' })
    const text = transcript.map(t => t.text).join(' ')
    return {
      text,
      title: `YouTube video (${videoId})`,
      sourceType: 'youtube',
    }
  } catch {
    // Try English fallback
    try {
      const { YoutubeTranscript } = await import('youtube-transcript')
      const videoId = extractYouTubeId(url)
      const transcript = await YoutubeTranscript.fetchTranscript(videoId)
      const text = transcript.map(t => t.text).join(' ')
      return { text, title: `YouTube video (${videoId})`, sourceType: 'youtube' }
    } catch (e) {
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
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nomemientas/1.0)' }
    })
    const html = await res.text()
    const $ = cheerio.load(html)

    // Extract tweet text from meta description or structured data
    const metaDesc = $('meta[name="description"]').attr('content')
    const ogDesc = $('meta[property="og:description"]').attr('content')

    // Try structured data
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
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nomemientas/1.0)' }
    })
    const html = await res.text()
    const $ = cheerio.load(html)

    // Remove noise
    $('script, style, nav, header, footer, .ad, .ads, .sidebar, .comments, .share, .related').remove()

    // Try article content selectors
    const articleSelector = 'article, .article-body, .post-content, .entry-content, .content, main, .main-content, [role="main"]'
    let body = $(articleSelector).text()

    if (!body || body.length < 100) {
      // Fallback: grab all paragraphs
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
