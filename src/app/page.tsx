'use client'

import { useState } from 'react'

interface AnalysisResult {
  id: number
  url: string
  title: string
  analysis: {
    resumen: string
    afirmaciones_clave: Array<{
      texto: string
      tipo: string
      verificable: boolean
      explicacion: string
    }>
    lenguaje_emocional: string[]
    falacias: Array<{
      tipo: string
      ejemplo: string
      explicacion: string
    }>
    vago_vs_concreto: {
      vago: string[]
      concreto: string[]
    }
    que_se_deja_fuera: string
    traduccion_llana: string
    nivel_honestidad: number
  }
  politician: string
  party: string
}

type TabType = 'claims' | 'translation' | 'fallacies' | 'omissions'

export default function Home() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('claims')

  async function analyze() {
    if (!input.trim()) return

    setLoading(true)
    setError('')
    setResult(null)

    const isUrl = input.trim().match(/^https?:\/\//)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isUrl ? { url: input.trim() } : { text: input.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error desconocido')
        return
      }

      setResult(data)
    } catch (e: any) {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      {/* Hero */}
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
        <div className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
            <span className="text-white">no</span>
            <span className="text-red-500">me</span>
            <span className="text-white">mientas</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-lg mx-auto">
            Pega un enlace o texto. Te decimos lo que el político
            <span className="text-white font-medium"> realmente </span>
            está diciendo.
          </p>
        </div>

        {/* Search input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && analyze()}
            placeholder="Pega un enlace de YouTube, Twitter, artículo... o texto directo"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-base text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-colors"
            disabled={loading}
          />
          <button
            onClick={analyze}
            disabled={loading || !input.trim()}
            className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium px-6 py-4 rounded-xl transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                Analizando
              </span>
            ) : 'Analizar'}
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center">
          Compatible con YouTube, Twitter/X, artículos de prensa y texto libre
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-auto max-w-3xl px-4 -mt-8 mb-12">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="mx-auto max-w-3xl px-4 pb-20">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-white/5 rounded w-3/4 mx-auto" />
              <div className="h-4 bg-white/5 rounded w-1/2 mx-auto" />
              <div className="h-4 bg-white/5 rounded w-2/3 mx-auto" />
            </div>
            <p className="text-gray-500 mt-6 text-sm">
              Extrayendo y analizando el discurso...
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="mx-auto max-w-3xl px-4 pb-20">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {/* Honesty score */}
            <div className="p-6 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Resultado del análisis</h2>
                  {result.url && (
                    <a href={result.url} target="_blank" rel="noopener" className="text-xs text-gray-500 hover:text-gray-300 truncate block max-w-md">
                      {result.url}
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Nivel de honestidad</div>
                  <div className={`text-4xl font-bold ${
                    result.analysis.nivel_honestidad >= 7 ? 'text-green-400' :
                    result.analysis.nivel_honestidad >= 4 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {result.analysis.nivel_honestidad}<span className="text-lg text-gray-500">/10</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Plain translation - always visible */}
            <div className="p-6 border-b border-white/[0.06] bg-white/[0.02]">
              <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Traducción llana
              </h3>
              <p className="text-lg text-white font-medium">
                &ldquo;{result.analysis.traduccion_llana}&rdquo;
              </p>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4">
              <div className="flex gap-1 border-b border-white/10">
                {([
                  { id: 'claims', label: 'Afirmaciones' },
                  { id: 'translation', label: 'Resumen' },
                  { id: 'fallacies', label: 'Falacias' },
                  { id: 'omissions', label: 'Omisos' },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-red-500 text-white'
                        : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="p-6">
              {activeTab === 'claims' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
                    Afirmaciones clave
                  </h3>
                  {result.analysis.afirmaciones_clave?.map((claim, i) => (
                    <div key={i} className="bg-white/[0.03] rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 px-2 py-0.5 text-xs rounded font-medium ${
                          claim.tipo === 'dato' ? 'bg-blue-500/20 text-blue-400' :
                          claim.tipo === 'promesa' ? 'bg-green-500/20 text-green-400' :
                          claim.tipo === 'ataque' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {claim.tipo}
                        </span>
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">&ldquo;{claim.texto}&rdquo;</p>
                          <p className="text-gray-400 text-sm mt-1">{claim.explicacion}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {claim.verificable ? '✓ Verificable' : '✗ No verificable directamente'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'translation' && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
                    Resumen del análisis
                  </h3>
                  <p className="text-gray-300 leading-relaxed">{result.analysis.resumen}</p>
                </div>
              )}

              {activeTab === 'fallacies' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
                    Falacias lógicas detectadas
                  </h3>
                  {result.analysis.falacias?.length === 0 ? (
                    <p className="text-gray-500">No se detectaron falacias evidentes.</p>
                  ) : (
                    result.analysis.falacias?.map((fallacy, i) => (
                      <div key={i} className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                        <p className="text-red-400 font-medium text-sm">{fallacy.tipo}</p>
                        <p className="text-gray-400 text-sm mt-1 italic">&ldquo;{fallacy.ejemplo}&rdquo;</p>
                        <p className="text-gray-500 text-sm mt-2">{fallacy.explicacion}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'omissions' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
                      Vago vs Concreto
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs text-red-400 mb-2">VAGO</h4>
                        <ul className="space-y-1">
                          {result.analysis.vago_vs_concreto?.vago?.map((v, i) => (
                            <li key={i} className="text-sm text-gray-400">· {v}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs text-green-400 mb-2">CONCRETO</h4>
                        <ul className="space-y-1">
                          {result.analysis.vago_vs_concreto?.concreto?.map((v: string, i: number) => (
                            <li key={i} className="text-sm text-gray-400">· {v}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
                      Lo que se calla
                    </h3>
                    <p className="text-gray-300">{result.analysis.que_se_deja_fuera}</p>
                  </div>
                  {result.analysis.lenguaje_emocional?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
                        Lenguaje emocional / manipulativo
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {result.analysis.lenguaje_emocional.map((term: string, i: number) => (
                          <span key={i} className="bg-orange-500/10 text-orange-400 px-3 py-1 rounded-full text-sm">
                            {term}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mx-auto max-w-3xl px-4 pb-8 text-center">
        <p className="text-xs text-gray-600">
          Herramienta agnóstica — se aplica el mismo análisis a cualquier político, sin importar partido o ideología.
        </p>
      </div>
    </div>
  )
}
