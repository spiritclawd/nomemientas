import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolvePoliticianSlug, getPoliticianProfile, getPoliticianAnalyses, getEnhancedPoliticianProfile } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })
  }

  // Try enhanced profile first (seed data)
  const enhanced = getEnhancedPoliticianProfile(slug)
  if (enhanced) {
    const url = new URL(req.url)
    const period = url.searchParams.get('period') || 'all'
    return NextResponse.json({
      slug,
      name: enhanced.name,
      party: enhanced.party?.name || '',
      profile: enhanced,
      analyses: { total: enhanced.analysis?.total_analyses || 0, avg_honesty: enhanced.analysis?.avg_honesty },
      period,
      source: 'seed',
    })
  }

  // Fallback to old resolve + profile + analyses
  const resolved = resolvePoliticianSlug(slug)
  if (!resolved) {
    return NextResponse.json({ error: 'Político no encontrado' }, { status: 404 })
  }

  const profile = getPoliticianProfile(resolved.name)
  if (!profile) {
    return NextResponse.json({ error: 'Sin datos para este político' }, { status: 404 })
  }

  const analyses = getPoliticianAnalyses(resolved.name)

  const url = new URL(req.url)
  const period = url.searchParams.get('period') || 'all'

  return NextResponse.json({
    slug,
    name: resolved.name,
    party: resolved.party,
    profile,
    analyses,
    period,
    source: 'analysis',
  })
}
