'use client'

import { useState, useEffect } from 'react'

const LIGHT = {
  page: '#f5f1eb', pageText: '#1a1a2e', subtext: '#5a5a5a', muted: '#8a7e6b',
  border: '#d4c9b8', borderLight: '#e8e0d4', accent: '#d63031', card: '#ffffff',
  tabBg: '#e8e0d4', green: '#2e7d32', greenBg: '#e8f5e9', orange: '#e65100',
  orangeBg: '#fff3e0', yellow: '#f57f17', yellowBg: '#fff8e1', red: '#c62828',
  redBg: '#ffebee', redBorder: '#ffcdd2', purple: '#7b1fa2', purpleBg: '#f3e5f5',
  blue: '#1565c0', blueBg: '#e3f2fd',
}

const DARK = {
  page: '#0f0f11', pageText: '#e8e6e3', subtext: '#a0a0a0', muted: '#707070',
  border: '#2a2a2e', borderLight: '#1e1e20', accent: '#ff4444', card: '#1a1a1e',
  tabBg: '#252528', green: '#66bb6a', greenBg: '#1b3320', orange: '#ff9800',
  orangeBg: '#2a1e0a', yellow: '#fbc02d', yellowBg: '#2a2510', red: '#ef5350',
  redBg: '#2a1515', redBorder: '#442020', purple: '#ce93d8', purpleBg: '#2a1f3e',
  blue: '#42a5f5', blueBg: '#1a2832',
}

function hc(h: number | null, c: typeof LIGHT): { bg: string; text: string } {
  const val = h ?? 5
  if (val >= 7) return { bg: c.greenBg, text: c.green }
  if (val >= 4) return { bg: c.yellowBg, text: c.yellow }
  return { bg: c.redBg, text: c.red }
}

function scoreBadge(s: number | null, c: typeof LIGHT): { bg: string; text: string } {
  const val = s ?? 5
  if (val >= 6) return { bg: c.greenBg, text: c.green }
  if (val >= 4) return { bg: c.yellowBg, text: c.yellow }
  return { bg: c.redBg, text: c.red }
}

function timeAgo(d: string): string {
  const sec = (Date.now() - new Date(d).getTime()) / 1000
  if (sec < 60) return 'ahora'
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`
  return `hace ${Math.floor(sec / 86400)} días`
}

type TabId = 'analyses' | 'promises' | 'biography' | 'legislation' | 'omissions'

export default function PoliticoPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState('')
  const [dark, setDark] = useState(false)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('analyses')
  const [expandedAnalysis, setExpandedAnalysis] = useState<number | null>(null)

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
    fetch(`/api/politician/${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return }; setData(d) })
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false))
  }, [slug])

  const c = dark ? DARK : LIGHT
  const toggleDark = () => setDark(p => { localStorage.setItem('nm-dark', (!p) ? '1' : '0'); return !p })

  if (loading) return (
    <div style={{ background: c.page, color: c.pageText, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: c.muted }}>Cargando ficha...</p>
    </div>
  )

  if (error || !data) return (
    <div style={{ background: c.page, color: c.pageText, minHeight: '100vh' }}>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-lg" style={{ color: c.red }}>{error || 'Sin datos'}</p>
        <a href="/" style={{ color: c.accent, textDecoration: 'underline', marginTop: 12, display: 'inline-block' }}>← Volver</a>
      </div>
    </div>
  )

  const isSeed = data.source === 'seed'
  const p = data.profile || {}

  // Normalize data shapes
  const displayName = isSeed ? p.name || data.name : data.name
  const partyName = isSeed ? p.party?.name || data.party : data.party
  const partyColor = isSeed ? p.party?.color || '' : ''
  const displayScore = isSeed ? p.composite_score : (p.avg_honesty ?? null)
  const scoreLabel = isSeed ? 'Score compuesto' : 'Honestidad media'
  const totalAnalyses = isSeed ? (p.analysis?.total_analyses || 0) : (data.analyses?.length || p.total_analyses || 0)
  const vsAll = p.vs_all || null
  const biography = isSeed ? p.biography || '' : ''
  const positions = isSeed ? (p.positions || []) : []
  const currentPosition = isSeed ? p.current_position || '' : ''

  // Promises
  const promises = isSeed ? (p.promises || []) : (p.aggregated?.all_promises || []).map((t: string) => ({ text: t, status: 'unknown' }))
  const promiseStats = isSeed ? p.promise_stats || {} : {
    total: p.aggregated?.promises || 0, kept: 0, broken: 0, partial: 0, pending: 0,
    kept_rate: p.aggregated?.promises > 0 ? 100 : 0,
  }

  // Legislation
  const relatedLegislation = isSeed ? (p.related_legislation || []) : []

  // Analyses array
  const analysisItems = isSeed ? [] : (Array.isArray(data.analyses) ? data.analyses : [])

  // Score breakdown
  const scores = isSeed ? p.scores || {} : {}

  const hCol = hc(displayScore, c)
  
  // JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: displayName,
    description: biography || `Análisis de honestidad de ${displayName}`,
    url: `https://nomemientas.org/politico/${slug}`,
    jobTitle: currentPosition || undefined,
    memberOf: partyName ? {
      '@type': 'Organization',
      name: partyName,
    } : undefined,
    knowsAbout: ['Política', 'Honestidad', 'Discursos'],
    subjectOf: {
      '@type': 'Dataset',
      name: `Análisis de honestidad de ${displayName}`,
      description: `Score de honestidad: ${displayScore?.toFixed(1) || '?'}/10`,
      measurementTechnique: 'Análisis de discurso con IA',
    },
  }
  
  const tabs: { id: TabId; label: string }[] = [
    { id: 'analyses' as const, label: `Análisis (${totalAnalyses})` },
    { id: 'promises' as const, label: `Promesas (${promiseStats.total})` },
  ]
  if (biography || currentPosition) tabs.push({ id: 'biography' as const, label: 'Biografía' })
  if (relatedLegislation.length > 0) tabs.push({ id: 'legislation' as const, label: 'Legislación' })
  if (p.aggregated?.all_omissions?.length > 0) tabs.push({ id: 'omissions' as const, label: 'Omisiones' })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div style={{ background: c.page, color: c.pageText, minHeight: '100vh' }}>
      <div className="mx-auto max-w-3xl px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6" style={{ borderBottom: `1px solid ${c.border}`, paddingBottom: 16 }}>
          <div className="flex items-center gap-4">
            <a href="/" style={{ color: c.accent, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
              ← nomemientas
            </a>
            <span style={{ color: c.muted, fontSize: '0.78rem' }}>
              {isSeed ? 'Ficha de político' : 'Análisis de discurso'}
            </span>
            {isSeed && <span style={{ background: c.tabBg, color: c.muted, padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem' }}>BASE DE DATOS</span>}
          </div>
          <button onClick={toggleDark} style={{ background: 'transparent', border: `1px solid ${c.border}`, color: c.muted, padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
            {dark ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Profile hero */}
        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 28, marginBottom: 20 }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '2rem', fontWeight: 500, color: c.pageText, margin: 0 }}>
                {displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {partyName && (
                  <span style={{
                    background: partyColor || c.tabBg,
                    color: partyColor ? '#fff' : c.subtext,
                    padding: '3px 10px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 600,
                  }}>
                    {partyName}
                  </span>
                )}
                {currentPosition && (
                  <span style={{ fontSize: '0.78rem', color: c.subtext }}>{currentPosition}</span>
                )}
                {vsAll && (
                  <span style={{ fontSize: '0.78rem', color: vsAll.diff > 0 ? c.green : vsAll.diff < 0 ? c.red : c.muted }}>
                    {vsAll.diff > 0 ? '▲' : vsAll.diff < 0 ? '▼' : '—'} {Math.abs(vsAll.diff).toFixed(1)} vs media ({vsAll.avg_all.toFixed(1)})
                  </span>
                )}
              </div>
            </div>
            <div className="text-center">
              <p style={{ fontSize: '0.65rem', color: c.muted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 2 }}>{scoreLabel}</p>
              <p style={{ fontSize: '3.2rem', fontWeight: 800, color: hCol.text, lineHeight: 1 }}>
                {displayScore?.toFixed(1) ?? '?'}<span style={{ fontSize: '1.2rem', color: c.muted, fontWeight: 400 }}>/10</span>
              </p>
              <p style={{ fontSize: '0.7rem', color: c.muted, marginTop: 4 }}>
                {totalAnalyses} análisis · Confianza: {isSeed ? (scores.composite ? 'media' : 'baja') : 'alta'}
              </p>
            </div>
          </div>
        </div>

        {/* Bio snippet */}
        {biography && (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: '14px 20px', marginBottom: 16 }}>
            <p style={{ fontSize: '0.85rem', color: c.subtext, lineHeight: 1.7, margin: 0 }}>{biography}</p>
          </div>
        )}

        {/* Score breakdown (seed) */}
        {isSeed && Object.keys(scores).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 20 }}>
            {['composite', 'honesty', 'promises_kept', 'consistency'].filter(k => scores[k] != null).map(k => {
              const sb = scoreBadge(scores[k], c)
              return (
                <div key={k} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: sb.text }}>{scores[k].toFixed(1)}</p>
                  <p style={{ fontSize: '0.6rem', color: c.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
                    {k === 'composite' ? 'Compuesto' : k === 'honesty' ? 'Discurso' : k === 'promises_kept' ? 'Promesas' : 'Consistencia'}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Promise stats bar */}
        {promiseStats.total > 0 && isSeed && (
          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 10, color: c.pageText }}>
              Promesas: {promiseStats.kept} cumplidas · {promiseStats.partial} parciales · {promiseStats.broken} rotas · {promiseStats.pending} pendientes
              <span style={{ color: c.muted, fontWeight: 400, marginLeft: 8 }}>({promiseStats.kept_rate}% cumplimiento)</span>
            </p>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: c.border }}>
              {promiseStats.kept > 0 && <div style={{ width: `${(promiseStats.kept / promiseStats.total) * 100}%`, height: '100%', background: c.green }} />}
              {promiseStats.partial > 0 && <div style={{ width: `${(promiseStats.partial / promiseStats.total) * 100}%`, height: '100%', background: c.orange }} />}
              {promiseStats.broken > 0 && <div style={{ width: `${(promiseStats.broken / promiseStats.total) * 100}%`, height: '100%', background: c.red }} />}
              {promiseStats.pending > 0 && <div style={{ width: `${(promiseStats.pending / promiseStats.total) * 100}%`, height: '100%', background: c.muted }} />}
            </div>
          </div>
        )}

        {/* Stats grid */}
        {!isSeed && p.aggregated && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Promesas', value: p.aggregated.promises, color: c.orange },
              { label: 'Afirmaciones', value: p.aggregated.total_claims, color: c.pageText },
              { label: 'Datos', value: p.aggregated.facts, color: c.green },
              { label: 'Ataques', value: p.aggregated.attacks, color: c.red },
              { label: 'Opiniones', value: p.aggregated.opinions, color: c.yellow },
            ].map((s, i) => (
              <div key={i} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: s.color }}>{s.value}</p>
                <p style={{ fontSize: '0.65rem', color: c.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Honesty evolution (analysis mode) */}
        {!isSeed && p.evolution?.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: p.evolution.length > 1 ? '1.5fr 1fr' : '1fr', gap: 12, marginBottom: 20 }}>
            {p.evolution.length > 1 && (
              <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 20 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 14, color: c.pageText }}>Evolucion de honestidad</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90, padding: '0 2px' }}>
                  {p.evolution.map((e: any, i: number) => {
                    const h = e.honesty ?? 5
                    const col = hc(h, c)
                    const height = (h / 10) * 80
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                        title={`${h}/10 — ${e.created_at?.slice(0, 10)}`}>
                        <div style={{ width: '100%', height, borderRadius: '2px 2px 0 0', background: col.text, opacity: 0.8 }} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {p.aggregated?.honesty_distribution && (
              <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 20 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 12, color: c.pageText }}>Distribucion</p>
                {[
                  { label: 'Alta (7-10)', count: p.aggregated.honesty_distribution.high, color: c.green },
                  { label: 'Media (4-6)', count: p.aggregated.honesty_distribution.mid, color: c.yellow },
                  { label: 'Baja (0-3)', count: p.aggregated.honesty_distribution.low, color: c.red },
                ].map((d, i) => {
                  const total = p.evolution.length
                  const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
                  return (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: '0.75rem', color: c.subtext }}>{d.label}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: d.color }}>{d.count} ({pct}%)</span>
                      </div>
                      <div style={{ background: c.border, height: 6, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: d.color, borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${c.border}`, marginBottom: 16, overflowX: 'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                background: 'transparent', border: 'none', borderBottom: activeTab === t.id ? `2px solid ${c.accent}` : '2px solid transparent',
                padding: '10px 18px', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600,
                color: activeTab === t.id ? c.accent : c.muted, cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Promesas */}
        {activeTab === 'promises' && (
          <div>
            {promises.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {promises.map((pr: any, i: number) => {
                  const statusColor = pr.status === 'kept' ? c.green : pr.status === 'broken' ? c.red : pr.status === 'partial' ? c.orange : c.muted
                  const statusLabel = pr.status === 'kept' ? '✓ Cumplida' : pr.status === 'broken' ? '✗ Rota' : pr.status === 'partial' ? '◐ Parcial' : pr.status === 'pending' ? '○ Pendiente' : '—'
                  return (
                    <div key={i} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 6, padding: '12px 16px' }}>
                      <div className="flex items-start gap-3">
                        <span style={{ color: statusColor, fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap', marginTop: 2 }}>{statusLabel}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: c.pageText, fontSize: '0.88rem', margin: 0 }}>{pr.text}</p>
                          {(pr.topic || pr.date_made) && (
                            <p style={{ color: c.muted, fontSize: '0.72rem', marginTop: 4 }}>
                              {pr.topic && <span>#{pr.topic}</span>}
                              {pr.date_made && <span> · {pr.date_made?.slice(0, 10)}</span>}
                              {pr.source_description && <span> · {pr.source_description}</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p style={{ color: c.muted, textAlign: 'center', padding: 30, fontSize: '0.9rem' }}>
                Sin promesas registradas todavia
              </p>
            )}
          </div>
        )}

        {/* Tab: Biografia */}
        {activeTab === 'biography' && (
          <div>
            <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 20 }}>
              {currentPosition && (
                <p style={{ fontSize: '0.85rem', color: c.subtext, marginBottom: 12, lineHeight: 1.7 }}>
                  <strong>Cargo actual:</strong> {currentPosition}
                </p>
              )}
              {biography && (
                <p style={{ fontSize: '0.9rem', color: c.pageText, lineHeight: 1.8, whiteSpace: 'pre-line' }}>{biography}</p>
              )}
              {positions.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: '0.7rem', color: c.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Cargos previos</p>
                  {positions.map((pos: any, i: number) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: i < positions.length - 1 ? `1px dashed ${c.borderLight}` : 'none' }}>
                      <p style={{ fontSize: '0.85rem', color: c.pageText }}>{pos}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Legislacion */}
        {activeTab === 'legislation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {relatedLegislation.map((l: any, i: number) => (
              <div key={i} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 16 }}>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: c.pageText, marginBottom: 4 }}>{l.title}</p>
                <p style={{ fontSize: '0.78rem', color: c.subtext, lineHeight: 1.5 }}>{l.summary}</p>
                <p style={{ fontSize: '0.72rem', color: c.muted, marginTop: 6 }}>
                  {l.date_published?.slice(0, 10)} · {l.category}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Omisiones */}
        {activeTab === 'omissions' && (
          <div>
            {p.aggregated?.all_omissions?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.aggregated.all_omissions.map((o: string, i: number) => (
                  <div key={i} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 6, padding: 16 }}>
                    <p style={{ fontSize: '0.7rem', color: c.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      Analisis #{i + 1}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: c.subtext, lineHeight: 1.6 }}>{o}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: c.muted, textAlign: 'center', padding: 30, fontSize: '0.9rem' }}>
                Sin omisiones registradas todavia
              </p>
            )}
          </div>
        )}

        {/* Tab: Analisis */}
        {activeTab === 'analyses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isSeed ? (
              <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, padding: 24, textAlign: 'center' }}>
                <p style={{ fontSize: '1rem', fontWeight: 600, color: c.pageText, marginBottom: 8 }}>Datos de base de conocimiento</p>
                <p style={{ fontSize: '0.85rem', color: c.subtext, lineHeight: 1.7 }}>
                  Este perfil combina datos de Wikipedia, BOE, seguimiento de promesas y {totalAnalyses} analisis de discursos.
                  Cada nuevo analisis de nomemientas actualiza automaticamente esta ficha.
                </p>
                <a href="/" style={{ color: c.accent, fontSize: '0.85rem', textDecoration: 'underline', marginTop: 12, display: 'inline-block' }}>
                  Analizar un discurso →
                </a>
              </div>
            ) : analysisItems.length === 0 ? (
              <p style={{ color: c.muted, textAlign: 'center', padding: 30 }}>Sin analisis todavia</p>
            ) : (
              analysisItems.map((a: any) => {
                const ac = hc(a.honesty, c)
                const isExpanded = expandedAnalysis === a.id
                let claims: any[] = []
                try { claims = JSON.parse(a.afirmaciones || '[]') } catch {}
                return (
                  <div key={a.id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <div className="flex items-start justify-between gap-4" style={{ padding: 16, cursor: 'pointer' }}
                      onClick={() => setExpandedAnalysis(isExpanded ? null : a.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.9rem', color: c.pageText, lineHeight: 1.5, marginBottom: 4 }}>
                          &ldquo;{a.traduccion || a.resumen?.slice(0, 120) || '—'}&rdquo;
                        </p>
                        <p style={{ fontSize: '0.72rem', color: c.muted }}>
                          {timeAgo(a.created_at)} · {a.source_type === 'youtube' ? '🎬' : a.url === 'manual' ? '📝' : '🔗'}
                          {a.url && a.url !== 'manual' && <span> · <a href={a.url} target="_blank" onClick={e => e.stopPropagation()} style={{ color: c.accent, textDecoration: 'none' }}>fuente</a></span>}
                        </p>
                      </div>
                      <span style={{ background: ac.bg, color: ac.text, padding: '2px 10px', borderRadius: 4, fontSize: '1.1rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {a.honesty ?? '?'}<span style={{ fontSize: '0.65rem', color: c.muted }}>/10</span>
                      </span>
                    </div>
                    {isExpanded && (
                      <div style={{ borderTop: `1px dashed ${c.borderLight}`, padding: '12px 16px 16px' }}>
                        {a.resumen && (
                          <p style={{ fontSize: '0.85rem', color: c.subtext, marginBottom: 10, lineHeight: 1.6 }}>
                            <span style={{ fontWeight: 600, color: c.pageText }}>Resumen: </span>{a.resumen}
                          </p>
                        )}
                        {claims.length > 0 && (
                          <div>
                            <p style={{ fontSize: '0.7rem', color: c.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                              Afirmaciones clave
                            </p>
                            {claims.map((cl: any, j: number) => {
                              const tColor = cl.tipo === 'promesa' ? c.orange : cl.tipo === 'dato' ? c.green : cl.tipo === 'ataque' ? c.red : c.subtext
                              return (
                                <div key={j} style={{ padding: '8px 0', borderBottom: j < claims.length - 1 ? `1px dashed ${c.borderLight}` : 'none' }}>
                                  <p style={{ fontSize: '0.85rem', color: c.pageText, marginBottom: 2 }}>
                                    <span style={{ color: tColor, fontWeight: 600 }}>[{cl.tipo}]</span> {cl.texto}
                                  </p>
                                  <p style={{ fontSize: '0.78rem', color: c.subtext }}>{cl.explicacion}</p>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: 'center', color: c.muted, fontSize: '0.7rem', marginTop: 32, borderTop: `1px solid ${c.border}`, paddingTop: 20 }}>
          <a href="/" style={{ color: c.accent, textDecoration: 'none' }}>nomemientas</a>
          {isSeed ? ' · Datos de base de conocimiento + analisis publicos' : ' · Datos basados en analisis publicos'}
          {vsAll && <span> · {vsAll.total_politicians_identified || '24'} politicos en base de datos</span>}
        </p>
      </div>
    </div>
    </>
  )
}