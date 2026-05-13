import { NextRequest, NextResponse } from 'next/server'
import { recordEvent } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { analysisId, eventType, eventData } = body

    recordEvent(analysisId || null, eventType, JSON.stringify(eventData || {}))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
