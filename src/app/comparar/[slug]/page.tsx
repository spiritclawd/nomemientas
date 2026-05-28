'use client'

import { useState, useEffect } from 'react'

const LIGHT = {
  page: '#f5f1eb', pageText: '#1a1a2e', subtext: '#5a5a5a', muted: '#8a7e6b',
  border: '#d4c9b8', borderLight: '#e8e0d4', accent: '#d63031', card: '#ffffff',
  tabBg: '#e8e0d4', green: '#2e7d32', greenBg: '#e8f5e9', orange: '#e65100',
  orangeBg: '#fff3e0', yellow: '#f57f17', yellowBg: '#fff8e1', red: '#c62828',
  redBg: '#ffebee', redBorder: '#ffcdd2',
}

const DARK = {
  page: '#0f0f11', pageText: '#e8e6e3', subtext: '#a0a0a0', muted: '#707070',
  border: '#2a2a2e', borderLight: '#1e1e20', accent: '#ff4444', card: '#1a1a1e',
  tabBg: '#252528', green: '#66bb6a', greenBg: '#1b3320', orange: '#ff9800',
  orangeBg: '#2a1e0a', yellow: '#fbc02d', yellowBg: '#2a2510', red: '#ef5350',
  redBg: '#2a1515', redBorder: '#442020',
}

export default function CompararPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState('')
  const [dark, setDark] = useState(false)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('nm-dark')
    if (saved === '1') setDark(true)
  }, [])

  useEffect(() => {
    params.then(p => setSlug(p.slug))
  }, [params])

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    
    // Parse slug: pp-vs-psoe
    const parts = slug.split('-vs-')
    if (parts.length !== 2) {
      setError('Formato de comparación no válido')
      setLoading(false)
      return
    }
    
    const [party1Slug, party2Slug] = parts
    
    // Fetch both parties
    Promise.all([
      fetch(`/api/party/${encodeURIComponent(party1Slug)}`).then(r => r.json()),
      fetch(`/api/party/${encodeURIComponent(party2Slug)}`).then(r => r.json()),
    ])
      .then(([d1, d2]) => {
        if (d1.error || d2.error) {
          setError('Partido no encontrado')
          return
        }
        setData({ party1: d1.party || d1, party2: d2.party || d2 })
      })
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false))
  }, [slug])

  const c = dark ? DARK : LIGHT
  const toggleDark = () => setDark(p => { localStorage.setItem('nm-dark', (!p) ? '1' : '0'); return !p })

  if (loading) return (
    <div style={{ background: c.page, color: c.pageText, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: c.muted }}>Cargando comparación...</p>
    </div>
  )

  if (error || !data) return (
    <div style={{ background: c.page, color: c.pageText, minHeight: '100vh' }}>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-lg" style={{ color: c.red }}>{error || 'Error'}</p>
        <a href="/" style={{ color: c.accent, textDecoration: 'underline', marginTop: 12, display: 'inline-block' }}>← Volver</a>
      </div>
    </div>
  )

  const { party1, party2 } = data
  const score1 = party1.composite_score || 0
  const score2 = party2.composite_score || 0
  const winner = score1 > score2 ? party1 : score2 > score1 ? party2 : null

  return (
    <div style={{ background: c.page, color: c.pageText, minHeight: '100vh' }}>
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6" style={{ borderBottom: `1px solid ${c.border}`, paddingBottom: 16 }}>
          <div className="flex items-center gap-4">
            <a href="/" style={{ color: c.accent, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
              ← nomemientas
            </a>
            <span style={{ color: c.muted, fontSize: '0.78rem' }}>Comparación de partidos</span>
          </div>
          <button onClick={toggleDark} style={{ background: 'transparent', border: `1px solid ${c.border}`, color: c.muted, padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
            {dark ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '2rem', fontWeight: 500, color: c.pageText, marginBottom: 24, textAlign: 'center' }}>
          {party1.short_name || party1.name} vs {party2.short_name || party2.name}
        </h1>

        {/* Comparison cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {[party1, party2].map((party: any, i: number) => {
            const score = party.composite_score || 0
            const isWinner = winner?.slug === party.slug
            
            return (
              <div key={i} style={{
                background: c.card,
                border: `2px solid ${isWinner ? c.accent : c.border}`,
                borderRadius: 12,
                padding: 24,
                position: 'relative',
              }}>
                {isWinner && (
                  <div style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: c.accent,
                    color: '#fff',
                    padding: '4px 16px',
                    borderRadius: 20,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}>
                    MÁS HONESTO
                  </div>
                )}
                
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-4 h-4 rounded-full" style={{ background: party.color || '#888' }} />
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                    {party.short_name || party.name}
                  </h2>
                </div>
                
                {party.ideology && (
                  <p style={{ fontSize: '0.85rem', color: c.subtext, marginBottom: 16 }}>
                    {party.ideology}
                  </p>
                )}
                
                <div className="text-center mb-6">
                  <p style={{ fontSize: '4rem', fontWeight: 800, color: score >= 6 ? c.green : score >= 4 ? c.yellow : c.red, lineHeight: 1 }}>
                    {score.toFixed(1)}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: c.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Honestidad
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span style={{ fontSize: '0.85rem', color: c.subtext }}>Miembros</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{party.total_members}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ fontSize: '0.85rem', color: c.subtext }}>Análisis</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{party.total_analyses}</span>
                  </div>
                  {party.founded_year && (
                    <div className="flex justify-between">
                      <span style={{ fontSize: '0.85rem', color: c.subtext }}>Fundación</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{party.founded_year}</span>
                    </div>
                  )}
                </div>
                
                <a href={`/partido/${party.slug}`} style={{
                  display: 'block',
                  textAlign: 'center',
                  marginTop: 16,
                  padding: '10px 16px',
                  background: c.tabBg,
                  borderRadius: 8,
                  color: c.pageText,
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}>
                  Ver ficha completa →
                </a>
              </div>
            )
          })}
        </div>

        {/* Members comparison */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
            Miembros destacados
          </h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            {[party1, party2].map((party: any, i: number) => (
              <div key={i}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, color: party.color || c.pageText }}>
                  {party.short_name || party.name}
                </h4>
                <div className="space-y-2">
                  {party.members?.slice(0, 5).map((member: any, j: number) => (
                    <a key={j} href={`/politico/${member.slug}`} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: c.tabBg,
                      borderRadius: 6,
                      textDecoration: 'none',
                      color: c.pageText,
                    }}>
                      <span style={{ fontSize: '0.85rem' }}>{member.name}</span>
                      <span style={{ fontSize: '0.75rem', color: c.muted }}>→</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', color: c.muted, fontSize: '0.7rem', marginTop: 32, borderTop: `1px solid ${c.border}`, paddingTop: 20 }}>
          <a href="/" style={{ color: c.accent, textDecoration: 'none' }}>nomemientas</a> · Comparación basada en análisis públicos
        </p>
      </div>
    </div>
  )
}
