'use client'

import { useState, useEffect } from 'react'

function politicianSlug(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const LIGHT = {
  page: '#f5f1eb',
  pageText: '#1a1a2e',
  subtext: '#5a5a5a',
  muted: '#8a7e6b',
  border: '#d4c9b8',
  borderLight: '#e8e0d4',
  accent: '#d63031',
  card: '#ffffff',
  tabBg: '#e8e0d4',
  inputBg: '#ffffff',
  inputText: '#1a1a2e',
  inputPlaceholder: '#999',
  badgeGray: '#e0e0e0',
  badgeGrayText: '#333',
  green: '#2e7d32',
  greenBg: '#e8f5e9',
  orange: '#e65100',
  orangeBg: '#fff3e0',
  yellow: '#f57f17',
  yellowBg: '#fff8e1',
  red: '#c62828',
  redBg: '#ffebee',
  redBorder: '#ffcdd2',
  errorBg: '#fff5f5',
  errorBorder: '#ffcdd2',
  blue: '#1976d2',
  greenDark: '#2e7d32',
}

const DARK = {
  page: '#0f0f11',
  pageText: '#e8e6e3',
  subtext: '#a0a0a0',
  muted: '#707070',
  border: '#2a2a2e',
  borderLight: '#1e1e20',
  accent: '#ff4444',
  card: '#1a1a1e',
  tabBg: '#252528',
  inputBg: '#1a1a1e',
  inputText: '#e8e6e3',
  inputPlaceholder: '#555',
  badgeGray: '#2a2a2e',
  badgeGrayText: '#ccc',
  green: '#66bb6a',
  greenBg: '#1b3320',
  orange: '#ff9800',
  orangeBg: '#2a1e0a',
  yellow: '#fbc02d',
  yellowBg: '#2a2510',
  red: '#ef5350',
  redBg: '#2a1515',
  redBorder: '#442020',
  errorBg: '#2a1515',
  errorBorder: '#442020',
  blue: '#42a5f5',
  greenDark: '#66bb6a',
}

type Colors = typeof LIGHT

export default function Home() {
  const [dark, setDark] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [tab, setTab] = useState<'summary' | 'claims' | 'fallacies' | 'omissions'>('summary')
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [copied, setCopied] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [stats, setStats] = useState<{
    analysesToday: number; leaderboard: any[]; parties: any[];
    enhanced_global_stats?: { total_seeded_politicians: number; total_parties: number; total_promises: number; promise_summary: any };
    enhanced_leaderboard?: any[]; all_parties?: any[];
  }>({ analysesToday: 0, leaderboard: [], parties: [] })
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [selectedParty, setSelectedParty] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPartyComparison, setShowPartyComparison] = useState(false)
  const [partyComparison, setPartyComparison] = useState<any[]>([])

  // Fetch party comparison data
  useEffect(() => {
    if (showPartyComparison && partyComparison.length === 0) {
      fetch('/api/party-comparison')
        .then(r => r.json())
        .then(d => { if (d.parties) setPartyComparison(d.parties) })
        .catch(() => {})
    }
  }, [showPartyComparison, partyComparison.length])

  const c = dark ? DARK : LIGHT
  const isUrl = input.trim().match(/^https?:\/\//i)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('nm-dark') : null
    if (saved === '1') setDark(true)
  }, [])

  const toggleDark = () => {
    setDark(p => {
      localStorage.setItem('nm-dark', (!p) ? '1' : '0')
      return !p
    })
  }

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => { if (d.stats) setStats(d) })
      .catch(() => {})
  }, [result])

  async function analyze() {
    if (!input.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setFeedback(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isUrl ? { url: input.trim() } : { text: input.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error desconocido'); return }
      setResult(data)
      setTab('summary')
      track(data.id, 'analysis_complete')
      fetch('/api/stats').then(r => r.json()).then(d => { if (d.stats) setStats(d) }).catch(() => {})
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function track(analysisId: any, eventType: string, data: any = {}) {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId, eventType, eventData: data }),
    }).catch(() => {})
  }

  const handleFeedback = (vote: 'up' | 'down') => {
    setFeedback(vote)
    track(result?.id, 'feedback', { vote })
  }

  const shareText = () => {
    const a = result?.analysis
    return `nomemientas — ${a?.traduccion_llana || a?.resumen}\n\nHonestidad: ${a?.nivel_honestidad}/10\nnomemientas.org`
  }

  const handleNativeShare = async () => {
    const a = result?.analysis
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'nomemientas — Análisis político',
          text: `Honestidad: ${a?.nivel_honestidad}/10 — "${a?.traduccion_llana}"`,
          url: 'https://nomemientas.org',
        })
        track(result?.id, 'share_native')
      } catch {}
    } else {
      handleCopy()
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText())
    setCopied(true)
    track(result?.id, 'share')
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadImage = async () => {
    const node = document.getElementById('share-card')
    if (!node) return
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(node, { cacheBust: true, quality: 1 })
      const link = document.createElement('a')
      link.download = `nomemientas-${Date.now()}.png`
      link.href = dataUrl
      link.click()
      track(result?.id, 'share_image')
    } catch (e) {
      console.error(e)
    }
  }

  const handleTweet = () => {
    track(result?.id, 'share_twitter')
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}`, '_blank')
  }

  return (
    <div className="min-h-screen" style={{ background: c.page, color: c.pageText }}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pb-20 transition-colors duration-300">

        {/* Header */}
        <header className="flex items-center justify-between py-4 sm:py-6 border-b-2" style={{ borderColor: c.border }}>
          <div className="flex items-center gap-2">
            <svg className="nm-bubble" width="32" height="32" viewBox="0 0 100 100" fill="none">
              <path d="M20 35 C20 25 30 18 50 18 C70 18 80 25 80 35 C80 45 70 52 55 53 L55 68 L40 55 C28 53 20 45 20 35Z" stroke={c.accent} strokeWidth="4" fill="none"/>
            </svg>
            <span className="font-bold text-xl sm:text-2xl tracking-tight">
              no<span className="nm-logo-accent" style={{ color: c.accent }}>me</span>mientas
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:block" style={{ color: c.muted }}>
              {stats.analysesToday} analisis hoy
              {stats.enhanced_global_stats && ` · ${stats.enhanced_global_stats.total_seeded_politicians} politicos`}
            </span>
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg border-2 transition text-lg"
              style={{ borderColor: c.border, color: c.muted }}
              title={dark ? 'Modo claro' : 'Modo oscuro'}
            >
              {dark ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => { setShowPartyComparison(!showPartyComparison); setShowLeaderboard(false) }}
              className="text-sm font-medium px-4 py-2 rounded-lg border-2 transition"
              style={{ borderColor: showPartyComparison ? c.accent : c.border, color: showPartyComparison ? c.accent : c.muted }}
            >
              📊 Comparar
            </button>
            <button
              onClick={() => { setShowLeaderboard(!showLeaderboard); setShowPartyComparison(false) }}
              className="text-sm font-medium px-4 py-2 rounded-lg border-2 transition"
              style={{ borderColor: c.border, color: c.muted }}
            >
              📊 Ranking
            </button>
          </div>
        </header>

        {/* Party Comparison */}
        {showPartyComparison && (
          <div className="mt-6 rounded-xl border-2 p-4 sm:p-6" style={{ borderColor: c.border }}>
            <h2 className="text-lg font-bold mb-4">📊 Comparativa de partidos</h2>
            
            {partyComparison.length === 0 ? (
              <p className="py-8 text-center" style={{ color: c.muted }}>Cargando datos...</p>
            ) : (
              <div className="space-y-3">
                {partyComparison.map((p: any, i: number) => (
                  <div key={p.slug} className="rounded-xl border-2 p-4" style={{ borderColor: c.border }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                        <div>
                          <a href={`/partido/${p.slug}`} className="font-bold" style={{ color: c.pageText, textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.color = c.accent}
                            onMouseLeave={e => e.currentTarget.style.color = c.pageText}>
                            {p.short_name}
                          </a>
                          <span className="text-xs ml-2" style={{ color: c.muted }}>
                            {p.member_count} miembros · {p.ideology}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-block px-3 py-1 rounded-full text-base font-black" style={{
                          background: (p.avg_score || 0) >= 6 ? c.greenBg : (p.avg_score || 0) >= 4 ? c.yellowBg : c.redBg,
                          color: (p.avg_score || 0) >= 6 ? c.green : (p.avg_score || 0) >= 4 ? c.yellow : c.red,
                        }}>
                          {p.avg_score?.toFixed(1) || '?'}<span className="text-xs" style={{ color: c.muted }}>/10</span>
                        </span>
                      </div>
                    </div>
                    
                    {/* Score distribution bar */}
                    <div className="flex gap-1 mt-2" style={{ height: 6, borderRadius: 3, overflow: 'hidden' }}>
                      {p.score_distribution.high > 0 && (
                        <div style={{ width: `${(p.score_distribution.high / p.member_count) * 100}%`, background: c.green }} />
                      )}
                      {p.score_distribution.mid > 0 && (
                        <div style={{ width: `${(p.score_distribution.mid / p.member_count) * 100}%`, background: c.yellow }} />
                      )}
                      {p.score_distribution.low > 0 && (
                        <div style={{ width: `${(p.score_distribution.low / p.member_count) * 100}%`, background: c.red }} />
                      )}
                    </div>
                    <div className="flex justify-between mt-1 text-xs" style={{ color: c.muted }}>
                      <span>{p.score_distribution.high} alto</span>
                      <span>{p.score_distribution.mid} medio</span>
                      <span>{p.score_distribution.low} bajo</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {showLeaderboard && (
          <div className="mt-6 rounded-xl border-2 p-4 sm:p-6" style={{ borderColor: c.border }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                {selectedParty ? `📊 ${selectedParty}` : '📊 Ranking de partidos'}
              </h2>
              {selectedParty && (
                <button onClick={() => setSelectedParty(null)} className="text-sm font-medium px-3 py-1 rounded-lg border-2 transition" style={{ borderColor: c.border, color: c.muted }}>
                  ← Ver todos
                </button>
              )}
            </div>

            {!selectedParty && stats.parties?.length === 0 && stats.leaderboard?.length === 0 && !stats.enhanced_leaderboard?.length && (
              <p className="py-8 text-center" style={{ color: c.muted }}>Todavia no hay datos. !Empieza a analizar discursos!</p>
            )}

            {/* Enhanced leaderboard (seed data) */}
            {!selectedParty && stats.enhanced_leaderboard && (stats.enhanced_leaderboard as any[]).length > 0 && (() => {
              const el = stats.enhanced_leaderboard!
              const filtered = searchQuery 
                ? el.filter((p: any) => 
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (p.party && p.party.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                : el
              return (
              <div style={{ overflowX: 'auto' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.muted }}>
                    Politicos ({filtered.length}{searchQuery ? ` de ${el.length}` : ''})
                  </p>
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-xs px-3 py-1 rounded-lg border-2"
                    style={{ 
                      borderColor: searchQuery ? c.accent : c.border,
                      background: c.inputBg,
                      color: c.inputText,
                      width: 120
                    }}
                  />
                </div>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-b-2" style={{ borderColor: c.border }}>
                      <th className="py-3 pr-4 text-sm font-semibold" style={{ color: c.muted }}>#</th>
                      <th className="py-3 pr-4 text-sm font-semibold" style={{ color: c.muted }}>Politico</th>
                      <th className="py-3 pr-4 text-sm font-semibold text-center" style={{ color: c.muted }}>Score</th>
                      <th className="py-3 text-sm font-semibold" style={{ color: c.muted }}>Partido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p: any, i: number) => (
                      <tr key={i} className="border-b" style={{ borderColor: c.borderLight }}>
                        <td className="py-3 pr-4 text-lg font-bold" style={{ color: c.muted }}>{i + 1}</td>
                        <td className="py-3 pr-4 font-semibold">
                          <a href={`/politico/${p.slug}`} style={{ color: c.pageText, textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.color = c.accent}
                            onMouseLeave={e => e.currentTarget.style.color = c.pageText}>
                            {p.name}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="inline-block px-3 py-1 rounded-full text-base font-black" style={{
                            background: (p.composite_score || 5) >= 6 ? c.greenBg : (p.composite_score || 5) >= 4 ? c.yellowBg : c.redBg,
                            color: (p.composite_score || 5) >= 6 ? c.green : (p.composite_score || 5) >= 4 ? c.yellow : c.red,
                          }}>{p.composite_score?.toFixed(1) ?? '?'}<span className="text-xs" style={{ color: c.muted }}>/10</span></span>
                        </td>
                        <td className="py-3 text-sm" style={{ color: c.subtext }}>
                          {p.party ? <span style={{ background: c.tabBg, padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, color: c.subtext }}>{p.party}</span> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )
            })()}

            {!selectedParty && stats.parties?.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: c.muted }}>Partidos políticos</p>
                <div className="space-y-2 mb-6">
                  {stats.parties.map((p: any, i: number) => (
                    <button key={i} onClick={() => setSelectedParty(p.party)}
                      className="w-full text-left rounded-xl border-2 p-4 transition hover:opacity-80"
                      style={{ borderColor: c.border }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                          <div>
                            <p className="font-bold text-base">{p.party}</p>
                            <p className="text-xs" style={{ color: c.muted }}>{p.politicians_count} políticos · {p.total_checks} análisis</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-base font-black" style={{
                          background: p.avg_honesty >= 7 ? c.greenBg : p.avg_honesty >= 4 ? c.yellowBg : c.redBg,
                          color: p.avg_honesty >= 7 ? c.green : p.avg_honesty >= 4 ? c.yellow : c.red,
                        }}>
                          {p.avg_honesty}<span className="text-xs" style={{ color: c.muted }}>/10</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Politicians within selected party */}
            {selectedParty && (
              <div className="space-y-2">
                {stats.parties
                  .find((p: any) => p.party === selectedParty)
                  ?.politicians?.map((pol: any, i: number) => (
                    <div key={i} className="rounded-xl border-2 p-4" style={{ borderColor: c.border }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-base font-bold"><a href={`/politico/${politicianSlug(pol.politician)}`} style={{ color: c.pageText, textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.color = c.accent}
                            onMouseLeave={e => e.currentTarget.style.color = c.pageText}>{pol.politician}</a></span>
                        </div>
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-base font-black shrink-0 ml-3" style={{
                          background: pol.avg_honesty >= 7 ? c.greenBg : pol.avg_honesty >= 4 ? c.yellowBg : c.redBg,
                          color: pol.avg_honesty >= 7 ? c.green : pol.avg_honesty >= 4 ? c.yellow : c.red,
                        }}>
                          {pol.avg_honesty}<span className="text-xs" style={{ color: c.muted }}>/10</span>
                        </span>
                      </div>
                      <p className="mt-2 text-sm" style={{ color: c.subtext }}>
                        {pol.total_checks} análisis · Última: {pol.latest_translation ? `"${pol.latest_translation}"` : '—'}
                      </p>
                    </div>
                  ))}
                {(!stats.parties.find((p: any) => p.party === selectedParty)?.politicians?.length) && (
                  <p className="py-8 text-center" style={{ color: c.muted }}>No hay políticos identificados en este partido todavía.</p>
                )}
              </div>
            )}

            {/* Full individual leaderboard as fallback */}
            {!selectedParty && (!stats.parties?.length) && stats.leaderboard?.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: c.muted }}>Políticos individuales</p>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="border-b-2" style={{ borderColor: c.border }}>
                      <th className="py-3 pr-4 text-sm font-semibold" style={{ color: c.muted }}>Político</th>
                      <th className="py-3 pr-4 text-sm font-semibold text-center" style={{ color: c.muted }}>Análisis</th>
                      <th className="py-3 pr-4 text-sm font-semibold text-center" style={{ color: c.muted }}>Honestidad</th>
                      <th className="py-3 text-sm font-semibold" style={{ color: c.muted }}>Última traducción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.leaderboard?.map((p: any, i: number) => (
                      <tr key={i} className="border-b" style={{ borderColor: c.borderLight }}>
                        <td className="py-4 pr-4 font-semibold">
                          <a href={`/politico/${politicianSlug(p.politician)}`} style={{ color: c.pageText, textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.color = c.accent}
                            onMouseLeave={e => e.currentTarget.style.color = c.pageText}>
                            {p.politician}
                          </a>
                          {p.party ? <span className="text-xs ml-2" style={{ color: c.muted }}>({p.party})</span> : null}
                        </td>
                        <td className="py-4 pr-4 text-center text-lg font-bold">{p.total_checks}</td>
                        <td className="py-4 pr-4 text-center">
                          <span className="inline-block px-3 py-1 rounded-full text-lg font-black" style={{
                            background: p.avg_honesty >= 7 ? c.greenBg : p.avg_honesty >= 4 ? c.yellowBg : c.redBg,
                            color: p.avg_honesty >= 7 ? c.green : p.avg_honesty >= 4 ? c.yellow : c.red,
                          }}>{p.avg_honesty}<span className="text-sm" style={{ color: c.muted }}>/10</span></span>
                        </td>
                        <td className="py-4 text-sm" style={{ color: c.subtext, maxWidth: '300px' }}>
                          {p.latest_translation ? `"${p.latest_translation}"` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Main hero */}
        {!result && !loading && !showLeaderboard && (
          <div className="py-12 sm:py-20 text-center">
            <div className="flex items-center justify-center gap-3 mb-5">
              <svg className="nm-bubble" width="44" height="44" viewBox="0 0 100 100" fill="none">
                <path d="M20 35 C20 25 30 18 50 18 C70 18 80 25 80 35 C80 45 70 52 55 53 L55 68 L40 55 C28 53 20 45 20 35Z" stroke={c.accent} strokeWidth="3.5" fill="none"/>
                <circle cx="40" cy="33" r="3" fill={c.accent} className="nm-logo-accent"/>
                <circle cx="50" cy="33" r="3" fill={c.accent} className="nm-logo-accent" style={{ animationDelay: '0.5s' }}/>
                <circle cx="60" cy="33" r="3" fill={c.accent} className="nm-logo-accent" style={{ animationDelay: '1s' }}/>
              </svg>
              <span className="text-2xl sm:text-3xl font-black tracking-tight">
                no<span className="nm-logo-accent" style={{ color: c.accent }}>me</span>mientas
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
              ¿Qué dicen realmente los políticos?
            </h1>
            <p className="text-base sm:text-lg max-w-lg mx-auto mb-10 leading-relaxed" style={{ color: c.subtext }}>
              Analiza a tu político favorito y compártelo en redes. ¡Que no les salga gratis!
            </p>
          </div>
        )}

        {/* Input */}
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analyze()}
              placeholder={isUrl ? 'URL de YouTube, Twitter, artículo...' : 'O escribe el discurso directamente aquí...'}
              className="flex-1 border-2 rounded-xl px-5 py-4 text-base focus:outline-none transition"
              style={{
                borderColor: input ? c.accent + '40' : c.border,
                color: c.inputText,
                background: c.inputBg,
              }}
              disabled={loading}
            />
            <button
              onClick={analyze}
              disabled={loading || !input.trim()}
              className="font-bold text-base px-8 py-4 rounded-xl transition text-white disabled:opacity-50"
              style={{ background: c.accent }}
            >
              {loading ? 'Analizando...' : 'Analizar'}
            </button>
          </div>
          <p className="text-xs mt-3" style={{ color: c.muted }}>
            Compatible con YouTube • Twitter/X • Artículos de prensa • Texto libre
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto mt-6">
            <div className="rounded-xl p-4 border-2 flex items-start gap-3" style={{ borderColor: c.errorBorder, background: c.errorBg }}>
              <span className="text-lg shrink-0 mt-0.5">
                {error.includes('subtítulos') || error.includes('transcript') ? '📹' :
                 error.includes('Twitter') || error.includes('tuit') ? '🐦' :
                 error.includes('tardó') || error.includes('lenta') ? '⏰' :
                 error.includes('conexión') || error.includes('red') ? '📡' :
                 error.includes('API') ? '🤖' : '⚠️'}
              </span>
              <p className="text-sm leading-relaxed" style={{ color: c.red }}>{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="max-w-2xl mx-auto mt-10">
            <div className="rounded-xl border-2 p-10 text-center" style={{ borderColor: c.border }}>
              <p className="text-lg">⏳ Extrayendo y analizando…</p>
              <p className="text-sm mt-2" style={{ color: c.muted }}>Esto puede tardar unos segundos</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="max-w-2xl mx-auto mt-8 space-y-5">
            {/* Score card */}
            <div className="rounded-xl border-2 p-6" style={{ borderColor: c.border }}>
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="text-center sm:text-left">
                  <p className="text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: c.muted }}>Nivel de honestidad</p>
                  <p className="text-5xl font-black tabular-nums" style={{ color:
                    result.analysis?.nivel_honestidad >= 7 ? c.green :
                    result.analysis?.nivel_honestidad >= 4 ? c.yellow : c.red
                  }}>
                    {result.analysis?.nivel_honestidad ?? '?'}<span className="text-xl font-medium" style={{ color: c.muted }}>/10</span>
                  </p>
                </div>
                <div className="sm:text-left flex-1">
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: c.muted }}>Traducción llana</p>
                  <p className="text-base leading-relaxed font-medium">&ldquo;{result.analysis?.traduccion_llana}&rdquo;</p>
                </div>
              </div>
            </div>

            {/* Feedback */}
            <div className="flex items-center gap-3 justify-center">
              <span className="text-sm" style={{ color: c.muted }}>¿Te sirve el análisis?</span>
              {feedback ? (
                <span className="text-sm font-semibold" style={{ color: c.green }}>¡Gracias!</span>
              ) : (
                <>
                  <button onClick={() => handleFeedback('up')} className="px-4 py-2 rounded-lg border-2 transition text-lg" style={{ borderColor: c.border }}>👍 Sí</button>
                  <button onClick={() => handleFeedback('down')} className="px-4 py-2 rounded-lg border-2 transition text-lg" style={{ borderColor: c.border }}>👎 No</button>
                </>
              )}
            </div>

            {/* Share */}
            <div className="flex items-center gap-2 justify-center flex-wrap">
              <button onClick={handleCopy} className="text-sm font-medium px-4 py-2 rounded-lg border-2 transition" style={{ borderColor: c.border, color: c.muted }}>
                {copied ? '✓ Copiado' : '📋 Copiar resultado'}
              </button>
              <button onClick={handleNativeShare} className="text-sm font-medium px-4 py-2 rounded-lg border-2 transition sm:hidden" style={{ borderColor: c.border, color: c.muted }}>
                📤 Compartir
              </button>
              <button onClick={() => setShowShareModal(true)} className="text-sm font-medium px-4 py-2 rounded-lg border-2 transition" style={{ borderColor: c.border, color: c.muted }}>
                🖼️ Compartir como imagen
              </button>
              <button onClick={handleTweet} className="text-sm font-medium px-4 py-2 rounded-lg border-2 transition" style={{ borderColor: c.border, color: c.muted }}>
                Compartir en X
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 rounded-xl p-1" style={{ background: c.tabBg }}>
              {([
                { id: 'summary' as const, label: 'Resumen' },
                { id: 'claims' as const, label: 'Afirmaciones' },
                { id: 'fallacies' as const, label: 'Falacias' },
                { id: 'omissions' as const, label: 'Omisos' },
              ]).map((t) => (
                <button key={t.id} onClick={() => { setTab(t.id); track(result?.id, 'tab_open', { tab: t.id }) }}
                  className="flex-1 py-3 px-3 text-sm font-semibold rounded-lg transition-all"
                  style={{ background: tab === t.id ? c.pageText : 'transparent', color: tab === t.id ? c.page : c.muted }}
                >{t.label}</button>
              ))}
            </div>

            {/* Summary */}
            {tab === 'summary' && result.analysis?.resumen && (
              <div className="rounded-xl border-2 p-6" style={{ borderColor: c.border }}>
                <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: c.muted }}>Resumen del análisis</h3>
                <p className="text-base leading-relaxed">{result.analysis.resumen}</p>
              </div>
            )}

            {/* Claims */}
            {tab === 'claims' && result.analysis?.afirmaciones_clave && (
              <div className="space-y-3">
                {result.analysis.afirmaciones_clave.map((claim: any, i: number) => {
                  const badgeColors: Record<string, { bg: string; text: string }> = {
                    dato: { bg: c.blue, text: '#fff' },
                    promesa: { bg: c.green, text: '#fff' },
                    ataque: { bg: c.red, text: '#fff' },
                    opinión: { bg: c.badgeGray, text: c.badgeGrayText },
                  }
                  const bc = badgeColors[claim.tipo] || badgeColors['opinión']
                  return (
                    <div key={i} className="rounded-xl border-2 p-4" style={{ borderColor: c.border }}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 px-3 py-1 text-xs rounded-lg font-semibold shrink-0" style={{ background: bc.bg, color: bc.text }}>{claim.tipo}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold mb-1">&ldquo;{claim.texto}&rdquo;</p>
                          <p className="text-sm" style={{ color: c.subtext }}>{claim.explicacion}</p>
                          <p className="text-xs mt-1.5" style={{ color: claim.verificable ? c.green : c.red }}>
                            {claim.verificable ? '✓ Verificable' : '✗ No verificable'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Fallacies */}
            {tab === 'fallacies' && (
              <div className="space-y-3">
                {!result.analysis?.falacias?.length ? (
                  <div className="rounded-xl border-2 p-8 text-center" style={{ borderColor: c.border }}>
                    <p className="text-lg" style={{ color: c.muted }}>No se detectaron falacias evidentes.</p>
                  </div>
                ) : result.analysis?.falacias?.map((f: any, i: number) => (
                  <div key={i} className="rounded-xl border-2 p-4" style={{ borderColor: c.redBorder }}>
                    <p className="text-sm font-bold" style={{ color: c.red }}>{f.tipo}</p>
                    <p className="text-sm mt-1 italic" style={{ color: c.subtext }}>&ldquo;{f.ejemplo}&rdquo;</p>
                    <p className="text-sm mt-2" style={{ color: c.subtext }}>{f.explicacion}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Omissions */}
            {tab === 'omissions' && (
              <div className="space-y-5">
                <div className="rounded-xl border-2 p-6" style={{ borderColor: c.border }}>
                  <h4 className="text-xs font-semibold mb-4 uppercase tracking-wider" style={{ color: c.muted }}>Vago vs concreto</h4>
                  <div className="grid sm:grid-cols-2 gap-6 text-sm">
                    <div>
                      <p className="text-sm font-bold mb-3" style={{ color: c.red }}>❌ VAGO</p>
                      <ul className="space-y-2">
                        {result.analysis?.vago_vs_concreto?.vago?.map((v: string, i: number) => <li key={i} style={{ color: c.subtext }}>· {v}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-bold mb-3" style={{ color: c.green }}>✅ CONCRETO</p>
                      <ul className="space-y-2">
                        {result.analysis?.vago_vs_concreto?.concreto?.map((v: string, i: number) => <li key={i} style={{ color: c.subtext }}>· {v}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border-2 p-6" style={{ borderColor: c.border }}>
                  <h4 className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: c.muted }}>Lo que se calla</h4>
                  <p className="text-base leading-relaxed">{result.analysis?.que_se_deja_fuera}</p>
                </div>
                {result.analysis?.lenguaje_emocional?.length > 0 && (
                  <div className="rounded-xl border-2 p-6" style={{ borderColor: c.border }}>
                    <h4 className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: c.muted }}>Lenguaje manipulativo</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.analysis.lenguaje_emocional.map((t: string, i: number) => (
                        <span key={i} className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: c.orangeBg, color: c.orange }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {/* Share Image Modal */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="rounded-2xl overflow-hidden max-w-md w-full" style={{ background: c.card }}>
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: c.border }}>
                <h3 className="font-bold text-lg" style={{ color: c.pageText }}>Compartir como imagen</h3>
                <button onClick={() => setShowShareModal(false)} className="text-2xl" style={{ color: c.muted }}>×</button>
              </div>
              <div className="p-6 flex justify-center bg-gray-100">
                <div
                  id="share-card"
                  className="rounded-xl overflow-hidden w-full max-w-xs"
                  style={{
                    background: dark ? '#0f0f11' : '#ffffff',
                    color: dark ? '#fff' : '#1a1a2e',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    aspectRatio: '1 / 1',
                    position: 'relative',
                  }}
                >
                  {/* Top accent bar */}
                  <div style={{ height: '6px', background: result.analysis?.nivel_honestidad >= 7 ? '#4ade80' : result.analysis?.nivel_honestidad >= 4 ? '#facc15' : '#f87171' }} />
                  
                  <div className="p-5 flex flex-col h-full">
                    {/* Brand */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg width="24" height="24" viewBox="0 0 100 100" fill="none">
                          <path d="M20 35 C20 25 30 18 50 18 C70 18 80 25 80 35 C80 45 70 52 55 53 L55 68 L40 55 C28 53 20 45 20 35Z" stroke={dark ? '#ff4444' : '#d63031'} strokeWidth="4" fill="none"/>
                        </svg>
                        <span className="font-bold text-base tracking-tight">no<span style={{ color: '#ff4444' }}>me</span>mientas</span>
                      </div>
                      {result.analysis?.party && (
                        <span className="px-2 py-1 rounded text-xs font-bold" style={{ 
                          background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                          color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
                        }}>
                          {result.analysis.party}
                        </span>
                      )}
                    </div>

                    {/* Politician name */}
                    {result.analysis?.politician && (
                      <p className="text-2xl font-black mb-4 text-center" style={{ color: dark ? '#fff' : '#1a1a2e' }}>
                        {result.analysis.politician}
                      </p>
                    )}

                    {/* Score */}
                    <div className="text-center mb-4">
                      <p className="text-7xl font-black mb-1" style={{ color:
                        result.analysis?.nivel_honestidad >= 7 ? '#4ade80' :
                        result.analysis?.nivel_honestidad >= 4 ? '#facc15' : '#f87171'
                      }}>
                        {result.analysis?.nivel_honestidad}
                      </p>
                      <p className="text-sm uppercase tracking-widest font-bold" style={{ color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
                        Honestidad
                      </p>
                    </div>

                    {/* Quote */}
                    <div className="flex-1 flex items-center justify-center">
                      <blockquote className="text-center text-sm italic leading-relaxed px-2" style={{ color: dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)' }}>
                        "{result.analysis?.traduccion_llana}"
                      </blockquote>
                    </div>

                    {/* Divider */}
                    <div className="mt-4 mb-2 border-t" style={{ borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />

                    {/* Footer */}
                    <p className="text-center text-xs font-medium" style={{ color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
                      Analizado en nomemientas.org
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t flex flex-wrap gap-2 justify-end" style={{ borderColor: c.border }}>
                <button onClick={() => {
                  const text = `${result.analysis?.politician || 'Político'} — Honestidad: ${result.analysis?.nivel_honestidad}/10\n\n"${result.analysis?.traduccion_llana}"\n\nAnalizado en nomemientas.org`;
                  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                  window.open(url, '_blank');
                  track(result?.id, 'share_whatsapp');
                }} className="font-bold px-4 py-2 rounded-lg text-white" style={{ background: '#25D366' }}>
                  WhatsApp
                </button>
                <button onClick={downloadImage} className="font-bold px-6 py-2 rounded-lg text-white" style={{ background: c.accent }}>
                  Descargar PNG
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="py-12 text-center mt-16 border-t-2 space-y-4" style={{ borderColor: c.border }}>
          <p className="text-sm max-w-md mx-auto" style={{ color: c.muted }}>
            Herramienta agnóstica — se aplica el mismo análisis a cualquier político, sin importar partido.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <a href="https://x.com/nomemientas" target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium px-4 py-2 rounded-lg border-2 transition hover:opacity-70 inline-flex items-center gap-2"
              style={{ borderColor: c.border, color: c.muted }}>
               Compartir feedback
            </a>
            <a href="https://chat.whatsapp.com/KZhTom1xPbbDkREPqas5OW" target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium px-4 py-2 rounded-lg border-2 transition hover:opacity-70 inline-flex items-center gap-2"
              style={{ borderColor: c.border, color: c.muted }}>
              💬 Comunidad WhatsApp
            </a>
          </div>
          <p className="text-xs pt-2" style={{ color: c.muted }}>
            Creado por <a href="https://x.com/carldlfr" target="_blank" rel="noopener noreferrer" className="font-medium hover:opacity-70 transition" style={{ color: c.accent }}>@carldlfr</a>
          </p>
        </footer>
      </div>
    </div>
  )
}
