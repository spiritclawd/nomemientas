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

function scoreColor(score: number, c: typeof LIGHT) {
  if (score >= 6) return { bg: c.greenBg, text: c.green }
  if (score >= 4) return { bg: c.yellowBg, text: c.yellow }
  return { bg: c.redBg, text: c.red }
}

function barColor(status: string, c: typeof LIGHT) {
  switch (status) {
    case 'kept': return c.green
    case 'broken': return c.red
    case 'partial': return c.orange
    case 'pending': return c.muted
    default: return c.muted
  }
}

function barLabel(status: string): string {
  switch (status) {
    case 'kept': return 'Cumplidas'
    case 'broken': return 'Rojas'
    case 'partial': return 'Parciales'
    case 'pending': return 'Pendientes'
    default: return status
  }
}

export default function PartyPage({ params }: { params: Promise<{ slug: string }> }) {
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
    fetch(`/api/party/${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setData(d) })
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false))
  }, [slug])

  const c = dark ? DARK : LIGHT
  const toggleDark = () => setDark(p => { localStorage.setItem('nm-dark', (!p) ? '1' : '0'); return !p })

  if (loading) return (
    <div style={{ background: c.page, color: c.pageText, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: c.muted }}>Cargando partido...</p>
    </div>
  )

  if (error || !data) return (
    <div style={{ background: c.page, color: c.pageText, minHeight: '100vh' }}>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-lg" style={{ color: c.red }}>{error || 'Partido no encontrado'}</p>
        <a href="/" style={{ color: c.accent, textDecoration: 'underline', marginTop: 12, display: 'inline-block' }}>← Volver al inicio</a>
      </div>
    </div>
  )

  const party = data.party || data
  const {
    name,
    short_name,
    founded_year,
    ideology,
    composite_score,
    total_members,
    total_analyses,
    legislation_count,
    promises,
    members,
  } = party
  const kept_rate = party.kept_rate ?? (promises ? Math.round(((promises.kept || 0) + (promises.partial || 0)) / (promises.total || 1) * 100) : 0)
  const keptRateDecimal = kept_rate / 100

  const sCol = scoreColor(composite_score ?? 0, c)

  const promiseTypes = [
    { status: 'kept', count: promises?.kept ?? 0 },
    { status: 'broken', count: promises?.broken ?? 0 },
    { status: 'partial', count: promises?.partial ?? 0 },
    { status: 'pending', count: promises?.pending ?? 0 },
  ]
  const totalPromises = promiseTypes.reduce((sum, p) => sum + p.count, 0)

  return (
    <div style={{ background: c.page, color: c.pageText, minHeight: '100vh' }}>
      <div className="mx-auto max-w-3xl px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6" style={{ borderBottom: `1px solid ${c.border}`, paddingBottom: 16 }}>
          <div className="flex items-center gap-4">
            <a href="/" style={{ color: c.accent, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
              ← nomemientas
            </a>
            <span style={{ color: c.muted, fontSize: '0.78rem' }}>Ficha de partido</span>
          </div>
          <button onClick={toggleDark} style={{ background: 'transparent', border: `1px solid ${c.border}`, color: c.muted, padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
            {dark ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Party hero card */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 28, marginBottom: 20 }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '2rem', fontWeight: 500, color: c.pageText, margin: 0 }}>
                {name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {short_name && (
                  <span style={{ background: c.tabBg, color: c.subtext, padding: '3px 10px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600 }}>
                    {short_name}
                  </span>
                )}
                {founded_year && (
                  <span style={{ background: c.greenBg, color: c.green, padding: '3px 10px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600 }}>
                    Fund. {founded_year}
                  </span>
                )}
                {ideology && (
                  <span style={{ background: c.orangeBg, color: c.orange, padding: '3px 10px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600 }}>
                    {ideology}
                  </span>
                )}
              </div>
            </div>
            {/* Composite score */}
            <div className="text-center">
              <p style={{ fontSize: '0.65rem', color: c.muted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 2 }}>Puntuación compuesta</p>
              <p style={{ fontSize: '3.2rem', fontWeight: 800, color: sCol.text, lineHeight: 1 }}>
                {composite_score ?? '—'}<span style={{ fontSize: '1.2rem', color: c.muted, fontWeight: 400 }}>/10</span>
              </p>
              <p style={{ fontSize: '0.7rem', color: c.muted, marginTop: 4 }}>
                {total_analyses ?? 0} {total_analyses === 1 ? 'análisis' : 'análisis'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Miembros', value: total_members ?? 0, color: c.pageText },
            { label: 'Análisis', value: total_analyses ?? 0, color: c.orange },
            { label: 'Iniciativas', value: legislation_count ?? 0, color: c.green },
            { label: 'Cumplimiento', value: kept_rate != null ? `${kept_rate}%` : '—', color: keptRateDecimal >= 0.6 ? c.green : keptRateDecimal >= 0.4 ? c.yellow : c.red },
          ].map((s, i) => (
            <div key={i} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: '0.65rem', color: c.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Promise breakdown */}
        {totalPromises > 0 && (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 14, color: c.pageText }}>Desglose de promesas</p>
            {promiseTypes.map((pt, i) => {
              const pct = totalPromises > 0 ? Math.round((pt.count / totalPromises) * 100) : 0
              const barC = barColor(pt.status, c)
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: '0.75rem', color: c.subtext }}>{barLabel(pt.status)}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: barC }}>{pt.count} ({pct}%)</span>
                  </div>
                  <div style={{ background: c.border, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barC, borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Members list */}
        {members?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 10, color: c.pageText }}>Miembros destacados</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map((m: any, i: number) => (
                <a
                  key={i}
                  href={`/politico/${encodeURIComponent(m.slug || m.name)}`}
                  style={{
                    background: c.card, border: `1px solid ${c.border}`, borderRadius: 6, padding: '13px 16px',
                    textDecoration: 'none', display: 'block', transition: 'border-color 0.15s',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontSize: '0.95rem', fontWeight: 600, color: c.pageText, margin: 0 }}>
                        {m.name}
                      </p>
                      {m.position && (
                        <p style={{ fontSize: '0.75rem', color: c.muted, marginTop: 2 }}>
                          {m.position}
                        </p>
                      )}
                    </div>
                    <span style={{ color: c.accent, fontSize: '0.85rem' }}>→</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: 'center', color: c.muted, fontSize: '0.7rem', marginTop: 32, borderTop: `1px solid ${c.border}`, paddingTop: 20 }}>
          <a href="/" style={{ color: c.accent, textDecoration: 'none' }}>nomemientas</a> · Datos basados en análisis públicos
        </p>
      </div>
    </div>
  )
}