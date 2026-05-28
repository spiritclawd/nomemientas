import { NextResponse } from 'next/server'
import { getAllParties } from '@/lib/db'

export async function GET() {
  const parties = getAllParties()
  return NextResponse.json({ parties })
}