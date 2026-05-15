import { NextRequest, NextResponse } from 'next/server'
import { extractFromUrl, validateUrl } from '@/lib/extract'
import { analyzeText } from '@/lib/analyze'

// Simple in-memory rate limiter (per IP)
const rateLimit = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimit.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (entry.count >= 5) {
    return false
  }

  entry.count++
  return true
}

function sanitizeInput(text: string): string {
  let clean = text.replace(/<[^>]*>/g, '')
  clean = clean.replace(/[\u200B-\u200D\u2060]/g, '')
  return clean.trim()
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
             req.headers.get('x-real-ip') ||
             'anonymous'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones. Espera un momento.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const { url, text } = body

    let sourceText = ''
    let sourceType = 'text'
    let processedUrl = url || ''
    let title = ''

    if (url) {
      const urlValidation = validateUrl(url)
      if (!urlValidation.valid) {
        return NextResponse.json(
          { error: urlValidation.reason },
          { status: 400 }
        )
      }

      // Race extraction against a 15s timeout
      const extraction = await Promise.race([
        extractFromUrl(url).catch(() => ({ text: '', title: '', sourceType: 'url' as const, reason: 'Error al extraer contenido.' })),
        new Promise<{ text: string; title: string; sourceType: 'url'; reason?: string }>((_, rej) =>
          setTimeout(() => rej(new Error('Extracción demasiado lenta')), 15_000)
        )
      ])

  console.log('[EXTRACT DEBUG] text length:', extraction?.text?.length, 'title length:', extraction?.title?.length, 'type:', extraction?.sourceType)

      if (!extraction.text || extraction.text.length < 50) {
        const failReason = (extraction as any).reason || 'No se pudo extraer contenido suficiente de esta URL. Prueba a pegar el texto directamente.'
        return NextResponse.json(
          { error: failReason },
          { status: 400 }
        )
      }
      sourceText = sanitizeInput(extraction.text)
      sourceType = extraction.sourceType
      title = sanitizeInput(extraction.title)
    } else if (text) {
      sourceText = sanitizeInput(text)
      sourceType = 'text'
      processedUrl = ''
    } else {
      return NextResponse.json(
        { error: 'Proporciona una URL o texto para analizar' },
        { status: 400 }
      )
    }

    // Guard: enough text to analyze
    if (sourceText.length < 50) {
      return NextResponse.json(
        { error: 'El texto es demasiado corto para analizar. Necesitamos al menos 50 caracteres.' },
        { status: 400 }
      )
    }

    // Run analysis with timeout
    const { analysis, politician, party } = await Promise.race([
      analyzeText(sourceText),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('El análisis tardó demasiado. Inténtalo con un texto más corto.')), 60_000)
      )
    ])

    // Save to hemeroteca (graceful fail if DB unavailable)
    let analysisId: number | null = null
    try {
      const { saveAnalysis } = await import('@/lib/db')
      analysisId = saveAnalysis(
        processedUrl || 'manual',
        analysis.resumen || '',
        JSON.stringify(analysis),
        sourceType,
        sourceText.slice(0, 5000)
      ) as number
    } catch {
      // DB unavailable — analysis still delivered
    }

    return NextResponse.json({
      id: analysisId,
      url: processedUrl,
      title,
      analysis,
      politician,
      party,
    })
  } catch (err: any) {
    console.error('Analysis error:', err)
    const msg = err?.message || ''
    if (msg.includes('tardó demasiado') || msg.includes('Extracción demasiado lenta') || msg.includes('timeout') || msg.includes('timed out')) {
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
