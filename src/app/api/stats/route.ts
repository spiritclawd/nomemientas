import { NextResponse } from 'next/server'
import { getTodayStats, getLeaderboard, getPartyLeaderboard } from '@/lib/db'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'

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

  // Fallback: local SQLite (empty on Vercel, full on laptop)
  try {
    const stats = getTodayStats()
    const leaderboard = getLeaderboard()
    const parties = getPartyLeaderboard()
    return NextResponse.json({ stats, leaderboard, parties })
  } catch {
    return NextResponse.json({ stats: { analysesToday: 0 }, leaderboard: [], parties: [] })
  }
}
