'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [tab, setTab] = useState<'summary' | 'claims' | 'fallacies' | 'omissions'>('summary')
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [copied, setCopied] = useState(false)
  const [stats, setStats] = useState({ analysesToday: 0 })

  const isUrl = input.trim().match(/^https?:\/\//i)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => { if (d.stats) setStats(d.stats) })
      .catch(() => {})
  }, [])

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
        body: JSON.stringify(
          isUrl ? { url: input.trim() } : { text: input.trim() }
        ),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error desconocido'); return }
      setResult(data)
      setTab('summary')
      track(data.id, 'analysis_complete')
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
    return `nomemientas — ${a?.traduccion_llana || a?.resumen}\n\nHonestidad: ${a?.nivel_honestidad}/10\n🗣️ https://nomemientas.aircade.xyz`
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText())
    setCopied(true)
    track(result?.id, 'share')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTweet = () => {
    track(result?.id, 'share_twitter')
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}`
    window.open(url, '_blank')
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[300px] bg-gradient-to-b from-red-950/20 to-transparent" />
      <div className="relative mx-auto max-w-3xl px-5 pb-24">
        <header className="flex items-center justify-between py-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗣️</span>
            <span className="font-bold text-lg tracking-tight">
              <span className="text-white">no</span><span className="text-red-500">me</span><span className="text-white">mientas</span>
            </span>
          </div>
          <span className="text-xs text-neutral-500 hidden sm:block">
            {stats.analysesToday} análisis hoy
          </span>
        </header>

        <main className="py-16 sm:py-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            ¿Qué te están diciendo<br /><span className="text-red-500">realmente</span>?
          </h1>
          <p className="text-neutral-400 text-base max-w-md mx-auto mb-10">
            Pega un enlace o un discurso. Quitamos la retórica y te mostramos
            lo que el político quiere que entiendas — sin filtros.
          </p>

          <div className="max-w-xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && analyze()}
                placeholder={isUrl ? 'URL de YouTube, Twitter, artículo...' : 'O escribe el discurso directamente...'}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-red-500/40 focus:ring-2 focus:ring-red-500/10 transition-all duration-200"
                disabled={loading}
              />
              <button
                onClick={analyze}
                disabled={loading || !input.trim()}
                className="bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold text-sm px-6 rounded-2xl transition-all duration-200 min-w-[110px]"
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="hidden sm:inline">Analizando</span>
                  </span>
                ) : 'Analizar'}
              </button>
            </div>
            <p className="text-xs text-neutral-600 mt-3">
              Compatible con YouTube · Twitter/X · Artículos · Texto libre
            </p>
          </div>
        </main>

        {error && (
          <div className="max-w-xl mx-auto mb-10 -mt-10">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
              {error}
            </div>
          </div>
        )}

        {loading && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 text-center">
              <div className="animate-pulse space-y-3 max-w-sm mx-auto">
                <div className="h-4 bg-white/5 rounded-full w-[80%]" />
                <div className="h-4 bg-white/5 rounded-full w-[60%]" />
                <div className="h-4 bg-white/5 rounded-full w-[45%]" />
              </div>
              <p className="text-neutral-500 mt-5 text-sm">Extrayendo y analizando…</p>
            </div>
          </div>
        )}

        {result && !loading && (
          <div className="max-w-xl mx-auto space-y-5">
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Nivel de honestidad</p>
                  <p className="text-5xl font-black tabular-nums" style={{ color:
                    result.analysis?.nivel_honestidad >= 7 ? '#4ade80' :
                    result.analysis?.nivel_honestidad >= 4 ? '#facc15' : '#f87171'
                  }}>
                    {result.analysis?.nivel_honestidad ?? '?'}<span className="text-xl text-neutral-500 font-medium">/10</span>
                  </p>
                </div>
                <div className="text-right max-w-[200px]">
                  <p className="text-xs text-neutral-500 uppercase tracking-widest mb-2">Traducción llana</p>
                  <p className="text-sm text-neutral-200 leading-relaxed italic">&ldquo;{result.analysis?.traduccion_llana}&rdquo;</p>
                </div>
              </div>
            </div>

            {/* Feedback */}
            <div className="flex items-center gap-3 justify-center">
              <span className="text-xs text-neutral-500">¿Te sirve el análisis?</span>
              {feedback ? (
                <span className="text-xs text-emerald-400 font-medium">¡Gracias!</span>
              ) : (
                <>
                  <button onClick={() => handleFeedback('up')} className="p-2 rounded-lg hover:bg-white/5 transition">👍</button>
                  <button onClick={() => handleFeedback('down')} className="p-2 rounded-lg hover:bg-white/5 transition">👎</button>
                </>
              )}
            </div>

            {/* Share */}
            <div className="flex items-center gap-2 justify-center">
              <button onClick={handleCopy} className="text-xs text-neutral-500 hover:text-white transition px-3 py-1.5 rounded-lg bg-white/5">
                {copied ? '✓ Copiado' : 'Copiar resultado'}
              </button>
              <button onClick={handleTweet} className="text-xs text-neutral-500 hover:text-white transition px-3 py-1.5 rounded-lg bg-white/5">
                Compartir en X
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
              {([
                { id: 'summary' as const, label: 'Resumen' },
                { id: 'claims' as const, label: 'Afirmaciones' },
                { id: 'fallacies' as const, label: 'Falacias' },
                { id: 'omissions' as const, label: 'Omisos' },
              ]).map((t) => (
                <button key={t.id} onClick={() => { setTab(t.id); track(result?.id, 'tab_open', { tab: t.id }) }}
                  className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-all ${tab === t.id ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                >{t.label}</button>
              ))}
            </div>

            {tab === 'summary' && result.analysis?.resumen && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-xs text-neutral-500 uppercase tracking-widest mb-3">Resumen del análisis</h3>
                <p className="text-neutral-300 leading-relaxed">{result.analysis.resumen}</p>
              </div>
            )}

            {tab === 'claims' && result.analysis?.afirmaciones_clave && (
              <div className="space-y-3">
                {result.analysis.afirmaciones_clave.map((c: any, i: number) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 px-2 py-0.5 text-[10px] rounded-md font-semibold uppercase tracking-wider shrink-0 ${
                        c.tipo === 'dato' ? 'bg-blue-500/20 text-blue-400' :
                        c.tipo === 'promesa' ? 'bg-emerald-500/20 text-emerald-400' :
                        c.tipo === 'ataque' ? 'bg-red-500/20 text-red-400' : 'bg-neutral-500/20 text-neutral-400'
                      }`}>{c.tipo}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white mb-1">&ldquo;{c.texto}&rdquo;</p>
                        <p className="text-xs text-neutral-400">{c.explicacion}</p>
                        <p className={`text-[10px] mt-1.5 ${c.verificable ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                          {c.verificable ? '✓ Verificable' : '✗ No verificable'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'fallacies' && (
              <div className="space-y-3">
                {!result.analysis?.falacias?.length ? (
                  <p className="text-neutral-500 text-sm text-center py-8">No se detectaron falacias evidentes.</p>
                ) : result.analysis?.falacias?.map((f: any, i: number) => (
                  <div key={i} className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                    <p className="text-red-400 text-sm font-semibold">{f.tipo}</p>
                    <p className="text-neutral-400 text-xs mt-1 italic">&ldquo;{f.ejemplo}&rdquo;</p>
                    <p className="text-neutral-500 text-xs mt-2">{f.explicacion}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'omissions' && (
              <div className="space-y-5">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                  <h4 className="text-xs text-neutral-500 uppercase tracking-widest mb-4">Vago vs concreto</h4>
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-red-400 font-semibold mb-2 text-xs">VAGO</p>
                      <ul className="space-y-1">
                        {result.analysis?.vago_vs_concreto?.vago?.map((v: string, i: number) => <li key={i} className="text-neutral-400 text-xs">· {v}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-semibold mb-2 text-xs">CONCRETO</p>
                      <ul className="space-y-1">
                        {result.analysis?.vago_vs_concreto?.concreto?.map((v: string, i: number) => <li key={i} className="text-neutral-400 text-xs">· {v}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                  <h4 className="text-xs text-neutral-500 uppercase tracking-widest mb-2">Lo que se calla</h4>
                  <p className="text-neutral-300 text-sm leading-relaxed">{result.analysis?.que_se_deja_fuera}</p>
                </div>
                {result.analysis?.lenguaje_emocional?.length > 0 && (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                    <h4 className="text-xs text-neutral-500 uppercase tracking-widest mb-3">Lenguaje manipulativo</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.analysis.lenguaje_emocional.map((t: string, i: number) => <span key={i} className="bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full text-xs">{t}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <footer className="py-20 text-center border-t border-white/5 mt-16">
          <p className="text-xs text-neutral-600">
            Herramienta agnóstica — mismo análisis para cualquier político, sin importar partido.
          </p>
        </footer>
      </div>
    </div>
  )
}
