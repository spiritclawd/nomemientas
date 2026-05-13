import { NextResponse } from 'next/server'
import { getTodayStats, getPublicAnalyses } from '@/lib/db'

export async function GET() {
  try {
    const stats = getTodayStats()
    const recent = getPublicAnalyses(15)
    return NextResponse.json({ stats, recent })
  } catch {
    return NextResponse.json({ stats: { analysesToday: 0 }, recent: [] })
  }
}
