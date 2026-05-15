import { NextRequest, NextResponse } from 'next/server'
import { extractFromUrl, validateUrl } from '@/lib/extract'
import { analyzeText } from '@/lib/analyze'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { hashInput, getCachedAnalysis, setCachedAnalysis } from '@/lib/db'

function sanitizeInput(text: string): string {
  let clean = text.replace(/<[^>]*>/g, '')
  clean = clean.replace(/[\u200B-\u200D\u2060]/g, '')
  return clean.trim()
}

// Try to proxy through the tunnel on Vercel. Falls back to local execution if tunnel is unreachable.
async function tryTunnelProxy(body: any, signal: AbortSignal): Promise<Response | null> {
  if (!process.env.VERCEL) return null // only proxy on Vercel
  try {
    const tunnelUrl = process.env.TUNNEL_URL || 'https://nomemientas.aircade.xyz'
    const res = await fetch(`${tunnelUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000), // shorter timeout for fallback
    })
    if (res.ok || res.status === 400) return res // pass through client errors too
    return null
  } catch {
    return null // tunnel unreachable — fall through to local
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  const rl = checkRateLimit(ip, { maxRequests: 5, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones. Espera un momento.', retryAfter: Math.ceil(rl.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
    )
  }

  try {
    const body = await req.json()
    const { url, text } = body
    const isUrl = !!(url && typeof url === 'string')

    // Try tunnel proxy first (Vercel only)
    const tunnelRes = await tryTunnelProxy(body, AbortSignal.timeout(30000))
    if (tunnelRes) {
      const data = await tunnelRes.json()
      return NextResponse.json(data, { status: tunnelRes.status })
    }

    // Falls through to local execution below
    let sourceText = ''
    let sourceType = 'text'
    let processedUrl = url || ''
    let title = ''

    if (isUrl) {
      const urlValidation = validateUrl(url)
      if (!urlValidation.valid) {
        return NextResponse.json({ error: urlValidation.reason }, { status: 400 })
      }

      const extraction = await Promise.race([
        extractFromUrl(url).catch(() => ({ text: '', title: '', sourceType: 'url' as const, reason: 'Error al extraer contenido.' })),
        new Promise<{ text: string; title: string; sourceType: 'url'; reason?: string }>((_, rej) =>
          setTimeout(() => rej(new Error('Extracción demasiado lenta')), 15_000)
        )
      ])

      console.log('[EXTRACT DEBUG] text length:', extraction?.text?.length, 'title length:', extraction?.title?.length, 'type:', extraction?.sourceType)

      if (!extraction.text || extraction.text.length < 50) {
        const failReason = (extraction as any).reason || 'No se pudo extraer contenido suficiente de esta URL. Prueba a pegar el texto directamente.'
        return NextResponse.json({ error: failReason }, { status: 400 })
      }
      sourceText = sanitizeInput(extraction.text)
      sourceType = extraction.sourceType
      title = sanitizeInput(extraction.title)
    } else if (text) {
      sourceText = sanitizeInput(text)
      sourceType = 'text'
      processedUrl = ''
    } else {
      return NextResponse.json({ error: 'Proporciona una URL o texto para analizar' }, { status: 400 })
    }

    if (sourceText.length < 50) {
      return NextResponse.json(
        { error: 'El texto es demasiado corto para analizar. Necesitamos al menos 50 caracteres.' },
        { status: 400 }
      )
    }

    // Check cache (text-only — URLs too varied)
    let cachedResult: any = null
    let cacheKey = ''
    if (!isUrl) {
      cacheKey = hashInput(sourceText)
      const cached = getCachedAnalysis(cacheKey)
      if (cached) {
        try {
          cachedResult = JSON.parse(cached)
        } catch {}
      }
    }
    if (cachedResult) {
      console.log('[CACHE HIT] returning cached result for hash', cacheKey)
      return NextResponse.json(cachedResult)
    }

    // Run analysis
    const { analysis, politician, party } = await Promise.race([
      analyzeText(sourceText),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('El análisis tardó demasiado.')), 60_000)
      )
    ])

    // Save to DB
    let analysisId: number | null = null
    try {
      const { saveAnalysis } = await import('@/lib/db')
      analysisId = saveAnalysis(
        processedUrl || 'manual',
        analysis.resumen || '',
        JSON.stringify(analysis),
        sourceType,
        sourceText.slice(0, 5000),
        politician,
        party
      ) as number
    } catch {}

    const responseBody = {
      id: analysisId,
      url: processedUrl,
      title,
      analysis,
      politician,
      party,
    }

    // Cache text results
    if (!isUrl && cacheKey) {
      setCachedAnalysis(cacheKey, 'text', JSON.stringify(responseBody))
    }

    return NextResponse.json(responseBody)
  } catch (err: any) {
    console.error('Analysis error:', err)
    const msg = err?.message || ''
    if (msg.includes('tardó') || msg.includes('timeout') || msg.includes('timed out')) {
      return NextResponse.json(
        { error: 'El análisis tardó demasiado. Prueba con un texto más corto o inténtalo de nuevo.' },
        { status: 408 }
      )
    }
    if (msg.includes('API')) {
      return NextResponse.json(
        { error: 'Error en el servicio de análisis. Inténtalo de nuevo en unos segundos.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Error interno del servidor. Inténtalo de nuevo.' },
      { status: 500 }
    )
  }
}

export const maxDuration = 60
