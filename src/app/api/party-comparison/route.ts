import { NextResponse } from 'next/server'
import { getPartyComparison } from '@/lib/db'

async function tryTunnelProxy(): Promise<Response | null> {
  if (!process.env.VERCEL) return null
  try {
    const tunnelUrl = process.env.TUNNEL_URL || 'https://nomemientas.aircade.xyz'
    const res = await fetch(`${tunnelUrl}/api/party-comparison`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) return res
    return null
  } catch {
    return null
  }
}

export async function GET() {
  // On Vercel, try tunnel first
  const tunnelRes = await tryTunnelProxy()
  if (tunnelRes) {
    const data = await tunnelRes.json()
    return NextResponse.json(data)
  }

  // Local fallback
  try {
    const parties = getPartyComparison()
    return NextResponse.json({ parties })
  } catch (e) {
    return NextResponse.json({ error: 'Error al cargar comparación' }, { status: 500 })
  }
}
