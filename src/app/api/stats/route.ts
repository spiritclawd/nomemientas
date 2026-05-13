import { NextResponse } from 'next/server'
import { getTodayStats, getLeaderboard } from '@/lib/db'

export async function GET() {
  try {
    const stats = getTodayStats()
    const leaderboard = getLeaderboard()
    return NextResponse.json({ stats, leaderboard })
  } catch {
    return NextResponse.json({ stats: { analysesToday: 0 }, leaderboard: [] })
  }
}
