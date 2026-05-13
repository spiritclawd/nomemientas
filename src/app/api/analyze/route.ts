import { NextRequest, NextResponse } from 'next/server'
import { extractFromUrl } from '@/lib/extract'
import { analyzeText } from '@/lib/analyze'
import { saveAnalysis } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, text } = body

    let sourceText = ''
    let sourceType = 'text'
    let processedUrl = url || ''
    let title = ''

    if (url) {
      const extraction = await extractFromUrl(url)
      if (!extraction.text) {
        // Fallback: try to fetch via web_search or just use URL
        return NextResponse.json(
          { error: 'No se pudo extraer contenido de esta URL. Prueba a pegar el texto directamente.' },
          { status: 400 }
        )
      }
      sourceText = extraction.text
      sourceType = extraction.sourceType
      title = extraction.title
    } else if (text) {
      sourceText = text
      sourceType = 'text'
      processedUrl = ''
    } else {
      return NextResponse.json(
        { error: 'Proporciona una URL o texto para analizar' },
        { status: 400 }
      )
    }

    if (sourceText.length < 50) {
      return NextResponse.json(
        { error: 'El texto extraído es demasiado corto para un análisis significativo.' },
        { status: 400 }
      )
    }

    // Run analysis
    const { analysis, politician, party } = await analyzeText(sourceText)

    // Save to hemeroteca
    const id = saveAnalysis(
      processedUrl || 'manual',
      analysis.resumen || '',
      JSON.stringify(analysis),
      sourceType,
      sourceText.slice(0, 5000)  // Store truncated content
    )

    return NextResponse.json({
      id: Number(id),
      url: processedUrl,
      title,
      analysis,
      politician,
      party,
    })
  } catch (err: any) {
    console.error('Analysis error:', err)
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const maxDuration = 60
