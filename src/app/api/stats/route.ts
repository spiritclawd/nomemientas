import { NextResponse } from 'next/server'
import { getTodayStats, getLeaderboard } from '@/lib/db'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(ip, { maxRequests: 60, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas peticiones.' }, { status: 429 })
  }

  try {
    const stats = getTodayStats()
    const leaderboard = getLeaderboard()
    return NextResponse.json({ stats, leaderboard })
  } catch {
    return NextResponse.json({ stats: { analysesToday: 0 }, leaderboard: [] })
  }
}
