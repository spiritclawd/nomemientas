import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const politician = searchParams.get('politician') || 'Político'
  const score = searchParams.get('score') || '?'
  const party = searchParams.get('party') || ''
  
  const scoreNum = parseFloat(score)
  const scoreColor = scoreNum >= 7 ? '#4ade80' : scoreNum >= 4 ? '#facc15' : '#f87171'
  
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f0f11',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Accent bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '8px',
          background: scoreColor,
        }} />
        
        {/* Brand */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '40px',
        }}>
          <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
            <path d="M20 35 C20 25 30 18 50 18 C70 18 80 25 80 35 C80 45 70 52 55 53 L55 68 L40 55 C28 53 20 45 20 35Z" stroke="#ff4444" strokeWidth="4" fill="none"/>
          </svg>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff' }}>
            no<span style={{ color: '#ff4444' }}>me</span>mientas
          </span>
        </div>

        {/* Politician name */}
        <div style={{
          fontSize: '64px',
          fontWeight: 'black',
          color: '#ffffff',
          textAlign: 'center',
          marginBottom: '16px',
          lineHeight: 1.1,
        }}>
          {politician}
        </div>

        {/* Party badge */}
        {party && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 24px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            marginBottom: '32px',
          }}>
            <span style={{ fontSize: '24px', color: 'rgba(255,255,255,0.7)' }}>
              {party}
            </span>
          </div>
        )}

        {/* Score */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{
            fontSize: '160px',
            fontWeight: 'black',
            color: scoreColor,
            lineHeight: 1,
          }}>
            {score}
          </div>
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '8px',
            marginTop: '8px',
          }}>
            HONESTIDAD
          </div>
        </div>

        {/* Footer */}
        <div style={{
          position: 'absolute',
          bottom: '40px',
          fontSize: '24px',
          color: 'rgba(255,255,255,0.3)',
        }}>
          Analizado en nomemientas.org
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
