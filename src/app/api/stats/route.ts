import { NextResponse } from 'next/server'
import { getTodayStats, getLeaderboard, getPartyLeaderboard, getEnhancedGlobalStats, getEnhancedLeaderboard, getAllParties } from '@/lib/db'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'

const MAINTENANCE_RESPONSE = {
  stats: { analysesToday: 0 },
  leaderboard: [],
  parties: [],
  maintenance: true,
  error: '¡Estamos desbordados! 🚀 El tráfico ha superado nuestras expectativas y estamos trabajando para ampliar la capacidad. Vuelve a intentarlo en unos minutos.'
}

async function tryTunnelProxy(): Promise<Response | null> {
  if (!process.env.VERCEL) return null
  try {
    const tunnelUrl = process.env.TUNNEL_URL || 'https://nomemientas.aircade.xyz'
    const res = await fetch(`${tunnelUrl}/api/stats`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) return res
    return null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(ip, { maxRequests: 60, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones.' }, { status: 429 })
  }

  // On Vercel, try the tunnel first (has the real data)
  const tunnelRes = await tryTunnelProxy()
  if (tunnelRes) {
    const data = await tunnelRes.json()
    return NextResponse.json(data)
  }

  // Tunnel unreachable
  if (process.env.VERCEL) {
    return NextResponse.json(MAINTENANCE_RESPONSE, { status: 503 })
  }

  // Local fallback: SQLite
  try {
    const stats = getTodayStats()
    const leaderboard = getLeaderboard()
    const parties = getPartyLeaderboard()
    const enhancedGlobalStats = getEnhancedGlobalStats()
    const enhancedLeaderboard = getEnhancedLeaderboard()
    const allParties = getAllParties()
    return NextResponse.json({
      stats,
      leaderboard,
      parties,
      enhanced_global_stats: {
        total_seeded_politicians: enhancedGlobalStats.seeded_politicians,
        total_parties: enhancedGlobalStats.total_parties,
        total_promises: enhancedGlobalStats.total_promises,
        promise_summary: enhancedGlobalStats.promise_summary,
      },
      enhanced_leaderboard: enhancedLeaderboard,
      all_parties: allParties.map(p => ({
        slug: p.slug,
        short_name: p.short_name,
        avg_score: p.avg_score,
        member_count: p.member_count,
      })),
    })
  } catch {
    return NextResponse.json({ stats: { analysesToday: 0 }, leaderboard: [], parties: [] })
  }
}
