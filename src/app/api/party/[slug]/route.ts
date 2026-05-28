import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPartyProfile } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })
  }

  const profile = getPartyProfile(slug)
  if (!profile) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ party: profile })
}