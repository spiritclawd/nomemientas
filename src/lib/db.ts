import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'

const DB_PATH = path.join(process.cwd(), 'db', 'nomemientas.db')

let db: Database.Database | null = null

/** Normaliza un string: lowercase, sin tildes, sin espacios múltiples */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getDb(): Database.Database {
  if (!db) {
    const dbDir = path.join(process.cwd(), 'db')
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('case_sensitive_like = OFF')

    // Registrar función normalize como SQL UDF para usarla en GROUP BY en runtime
    db.function('normalize', (val: string) => val ? normalize(val) : '')

    db.exec(`
      CREATE TABLE IF NOT EXISTS analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        source_type TEXT DEFAULT 'url',
        source_text TEXT NOT NULL,
        raw_content TEXT DEFAULT '',
        politician TEXT DEFAULT '',
        party TEXT DEFAULT '',
        analysis_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_url ON analyses(url);
      CREATE INDEX IF NOT EXISTS idx_created ON analyses(created_at DESC);

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        analysis_id INTEGER,
        event_type TEXT NOT NULL,
        event_data TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_event_type ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_event_date ON events(created_at DESC);

      CREATE TABLE IF NOT EXISTS analysis_cache (
        input_hash TEXT PRIMARY KEY,
        input_type TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_cache_hash ON analysis_cache(input_hash);
      CREATE INDEX IF NOT EXISTS idx_cache_created ON analysis_cache(created_at DESC);
    `)
  }
  return db
}

export function saveAnalysis(url: string, sourceText: string, analysisJson: string, sourceType = 'url', rawContent = '', politician = '', party = '') {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO analyses (url, source_type, source_text, raw_content, analysis_json, politician, party)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  return stmt.run(url, sourceType, sourceText, rawContent, analysisJson, politician, party).lastInsertRowid
}

export function recordEvent(analysisId: number | null, eventType: string, eventData = '') {
  try {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO events (analysis_id, event_type, event_data)
      VALUES (?, ?, ?)
    `)
    stmt.run(analysisId, eventType, eventData)
  } catch {
    // Fail silently
  }
}

export function getTodayAnalysisCount(): number {
  try {
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)
    return (db.prepare('SELECT COUNT(*) as total FROM analyses WHERE created_at >= ?').get(today) as Record<string, number>).total
  } catch {
    return 0
  }
}

export function getTodayStats() {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)

  const analyses = (db.prepare(`
    SELECT COUNT(*) as total FROM analyses WHERE created_at >= ?
  `).get(today) as Record<string, number>).total

  const avgHonesty = (db.prepare(`
    SELECT AVG(CAST(json_extract(analysis_json, '$.nivel_honestidad') AS REAL)) as avg
    FROM analyses WHERE created_at >= ? AND json_extract(analysis_json, '$.nivel_honestidad') IS NOT NULL
  `).get(today) as Record<string, number | null>).avg

  const feedback = db.prepare(`
    SELECT
      SUM(CASE WHEN json_extract(event_data, '$.vote') = 'up' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN json_extract(event_data, '$.vote') = 'down' THEN 1 ELSE 0 END) as negative,
      COUNT(*) as total
    FROM events WHERE event_type = 'feedback' AND created_at >= ?
  `).get(today) as Record<string, number>

  return {
    analysesToday: analyses,
    averageHonesty: avgHonesty !== null ? Math.round(avgHonesty * 10) / 10 : null,
    feedback: {
      total: feedback.total || 0,
      positive: feedback.positive || 0,
      negative: feedback.negative || 0,
    }
  }
}

export interface AnalysisRecord {
  id: number
  url: string
  source_type: string
  politician: string
  party: string
  analysis_json: string
  created_at: string
  level_honesty: number
}

export function getPublicAnalyses(limit = 20): any[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      id, url, source_type, politician, party,
      json_extract(analysis_json, '$.nivel_honestidad') as level_honesty,
      json_extract(analysis_json, '$.traduccion_llana') as traduccion,
      created_at
    FROM analyses
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit)
}

/**
 * Rank de políticos — SIN DUPLICADOS.
 * Agrupa por nombre normalizado (lowercase, sin tildes).
 * position: ranking 1-based.
 */
export function getLeaderboard(): any[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT
      politician,
      party,
      COUNT(*) as total_checks,
      ROUND(AVG(CAST(json_extract(analysis_json, '$.nivel_honestidad') AS REAL)), 1) as avg_honesty,
      MAX(created_at) as last_seen,
      json_extract(analysis_json, '$.traduccion_llana') as latest_translation
    FROM analyses
    WHERE politician != '' AND politician != 'Desconocido' AND politician IS NOT NULL
    GROUP BY normalize(politician)
    ORDER BY total_checks DESC
    LIMIT 50
  `).all() as any[]

  // Canonical display name: el mas largo entre todas las variantes del politico
  const canonical: Record<string, string> = {}
  const canonRows: { politician: string; norm: string }[] = db.prepare(`
    SELECT politician, normalize(politician) as norm
    FROM analyses
    WHERE politician != '' AND politician != 'Desconocido' AND politician IS NOT NULL
  `).all() as { politician: string; norm: string }[]
  canonRows.forEach((r: { politician: string; norm: string }) => {
      const key = r.norm
      if (!canonical[key] || r.politician.length > canonical[key].length) {
        canonical[key] = r.politician
      }
    })

  return rows.map((r: any, i: number) => ({
    position: i + 1,
    name: canonical[normalize(r.politician)] || r.politician,
    party: r.party || '',
    total_checks: r.total_checks,
    avg_honesty: r.avg_honesty ?? 0,
    last_seen: r.last_seen,
    latest_translation: r.latest_translation || '',
  }))
}

/**
 * Rank de partidos — SIN DUPLICADOS.
 * Agrupa por nombre normalizado.
 */
export function getPartyLeaderboard(): any[] {
  const db = getDb()

  const rows = db.prepare(`
    SELECT
      party,
      COUNT(*) as total_checks,
      COUNT(DISTINCT normalize(politician)) as politicians_count,
      ROUND(AVG(CAST(json_extract(analysis_json, '$.nivel_honestidad') AS REAL)), 1) as avg_honesty,
      MAX(created_at) as last_seen
    FROM analyses
    WHERE party != '' AND party IS NOT NULL
    GROUP BY normalize(party)
    ORDER BY total_checks DESC
    LIMIT 20
  `).all() as any[]

  const canonical: Record<string, string> = {}
  const canonRows: { party: string; norm: string }[] = db.prepare(`
    SELECT party, normalize(party) as norm
    FROM analyses
    WHERE party != '' AND party IS NOT NULL
  `).all() as { party: string; norm: string }[]
  for (const r of canonRows) {
    const key = r.norm
    if (!canonical[key] || r.party.length > canonical[key].length) {
      canonical[key] = r.party
    }
  }

  const resolved: any[] = []
  for (const r of (rows as any[])) {
    resolved.push({
      party: canonical[normalize(r.party)] || r.party,
      total_checks: r.total_checks,
      politicians_count: r.politicians_count || 0,
      avg_honesty: r.avg_honesty,
      last_seen: r.last_seen,
      politicians: [] as any[],
    })
  }
  return resolved
}

export function getAnalysisById(id: number): Record<string, any> | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM analyses WHERE id = ?').get(id)
  return row || null
}

/**
 * Normaliza un nombre de político a slug URL-friendly
 */
export function politicianSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Busca el nombre canónico de un político dado un slug
 */
export function resolvePoliticianSlug(slug: string): { name: string; party: string } | null {
  const db = getDb()
  const rows = db.prepare(`
    SELECT politician, party,
           CASE WHEN party != '' AND party IS NOT NULL THEN party ELSE '' END as party_val
    FROM analyses
    WHERE politician != '' AND politician != 'Desconocido' AND politician IS NOT NULL
    GROUP BY normalize(politician)
  `).all() as { politician: string; party: string }[]

  for (const row of rows) {
    if (politicianSlug(row.politician) === slug) {
      // Find canonical name (longest variant)
      const canonRows = db.prepare(`
        SELECT politician FROM analyses
        WHERE normalize(politician) = normalize(?)
        ORDER BY LENGTH(politician) DESC LIMIT 1
      `).get(row.politician) as { politician: string }
      return {
        name: canonRows?.politician || row.politician,
        party: row.party || ''
      }
    }
  }
  return null
}

/**
 * Perfil completo de un político
 */
export function getPoliticianProfile(politicianName: string): Record<string, any> | null {
  const db = getDb()
  
  // Stats agregados
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_analyses,
      ROUND(AVG(CAST(json_extract(analysis_json, '$.nivel_honestidad') AS REAL)), 1) as avg_honesty,
      MAX(created_at) as last_analysis,
      MIN(created_at) as first_analysis,
      COUNT(DISTINCT source_type) as source_types,
      SUM(CASE WHEN source_type = 'youtube' THEN 1 ELSE 0 END) as youtube_count,
      SUM(CASE WHEN url != 'manual' THEN 1 ELSE 0 END) as url_count
    FROM analyses
    WHERE normalize(politician) = normalize(?)
  `).get(politicianName) as Record<string, any>

  if (!stats || !stats.total_analyses) return null

  // Evolución de honestidad en el tiempo
  const evolution = db.prepare(`
    SELECT
      created_at,
      CAST(json_extract(analysis_json, '$.nivel_honestidad') AS REAL) as honesty,
      json_extract(analysis_json, '$.traduccion_llana') as translation,
      json_extract(analysis_json, '$.resumen') as resumen,
      json_extract(analysis_json, '$.que_se_deja_fuera') as omissions,
      url,
      source_type
    FROM analyses
    WHERE normalize(politician) = normalize(?)
    ORDER BY created_at ASC
  `).all(politicianName) as any[]

  // Partido (tomar el más frecuente)
  const partyRow = db.prepare(`
    SELECT party, COUNT(*) as c
    FROM analyses
    WHERE normalize(politician) = normalize(?) AND party != '' AND party IS NOT NULL
    GROUP BY party
    ORDER BY c DESC LIMIT 1
  `).get(politicianName) as { party: string } | undefined

  // Agregación de afirmaciones_clave de todos los análisis
  const allAnalyses = db.prepare(`
    SELECT analysis_json FROM analyses
    WHERE normalize(politician) = normalize(?)
  `).all(politicianName) as { analysis_json: string }[]

  let totalClaims = 0
  let promises = 0, facts = 0, opinions = 0, attacks = 0
  const allTranslations: string[] = []
  const allPromises: string[] = []
  const allOmissions: string[] = []

  for (const row of allAnalyses) {
    try {
      const parsed = JSON.parse(row.analysis_json)
      if (parsed.traduccion_llana) allTranslations.push(parsed.traduccion_llana)
      if (parsed.que_se_deja_fuera) allOmissions.push(parsed.que_se_deja_fuera)
      
      const claims = parsed.afirmaciones_clave || []
      for (const c of claims) {
        totalClaims++
        if (c.tipo === 'promesa') promises++
        else if (c.tipo === 'dato') facts++
        else if (c.tipo === 'opinión' || c.tipo === 'opinion') opinions++
        else if (c.tipo === 'ataque') attacks++
        // Collect promise texts
        if (c.tipo === 'promesa' && c.texto) allPromises.push(c.texto)
      }
    } catch {}
  }

  // Averages vs all politicians
  const globalStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      ROUND(AVG(CAST(json_extract(analysis_json, '$.nivel_honestidad') AS REAL)), 1) as avg_all
    FROM analyses
    WHERE politician != '' AND politician != 'Desconocido' AND politician IS NOT NULL
  `).get() as { total: number; avg_all: number | null }

  // Honesty distribution
  const dist = { low: 0, mid: 0, high: 0 }
  for (const e of evolution) {
    const h = e.honesty ?? 5
    if (h <= 3) dist.low++
    else if (h <= 6) dist.mid++
    else dist.high++
  }

  return {
    ...stats,
    party: partyRow?.party || '',
    evolution,
    avg_honesty: stats.avg_honesty ?? 0,
    aggregated: {
      total_claims: totalClaims,
      promises,
      facts,
      opinions,
      attacks,
      all_promises: allPromises.slice(0, 20),
      all_omissions: allOmissions.slice(0, 5),
      all_translations: allTranslations.slice(0, 10),
      honesty_distribution: dist,
    },
    vs_all: {
      avg_all: globalStats.avg_all ?? 0,
      total_politicians_identified: globalStats.total,
      diff: stats.avg_honesty !== null ? Math.round((stats.avg_honesty - (globalStats.avg_all ?? 0)) * 10) / 10 : 0,
    },
  }
}

/**
 * Últimos análisis de un político
 */
export function getPoliticianAnalyses(politicianName: string, limit = 20): any[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      id, url, source_type, source_text,
      CAST(json_extract(analysis_json, '$.nivel_honestidad') AS REAL) as honesty,
      json_extract(analysis_json, '$.resumen') as resumen,
      json_extract(analysis_json, '$.traduccion_llana') as traduccion,
      json_extract(analysis_json, '$.afirmaciones_clave') as afirmaciones,
      created_at
    FROM analyses
    WHERE normalize(politician) = normalize(?)
    ORDER BY created_at DESC
    LIMIT ?
  `).all(politicianName, limit)
}

// ---- Analysis Cache ----

export function hashInput(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function getCachedAnalysis(inputHash: string): string | null {
  try {
    const db = getDb()
    const row = db.prepare(
      'SELECT result_json FROM analysis_cache WHERE input_hash = ? AND created_at > datetime("now", "-24 hours")'
    ).get(inputHash) as { result_json: string } | undefined
    return row?.result_json || null
  } catch {
    return null
  }
}

export function setCachedAnalysis(inputHash: string, inputType: string, resultJson: string): void {
  try {
    const db = getDb()
    // Prune stale entries first (keep last 500)
    db.exec('DELETE FROM analysis_cache WHERE input_hash NOT IN (SELECT input_hash FROM analysis_cache ORDER BY created_at DESC LIMIT 500)')
    db.prepare(
      'INSERT OR REPLACE INTO analysis_cache (input_hash, input_type, result_json) VALUES (?, ?, ?)'
    ).run(inputHash, inputType, resultJson)
  } catch {
    // Cache is non-critical
  }
}

// ==========================================
// V2 — NEW FUNCTIONS (seed-based knowledge)
// ==========================================

/**
 * Get full party profile with aggregate stats
 */
export function getPartyProfile(partySlug: string): Record<string, any> | null {
  const db = getDb()
  const party = db.prepare(`
    SELECT * FROM parties WHERE slug = ?
  `).get(partySlug) as Record<string, any> | undefined
  if (!party) return null

  const members = db.prepare(`
    SELECT slug, display_name, current_position, biography
    FROM politicians WHERE party_id = ?
    ORDER BY display_name ASC
  `).all(party.id) as any[]

  // Aggregate promise stats for this party
  const promiseStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'kept' THEN 1 ELSE 0 END) as kept,
      SUM(CASE WHEN status = 'broken' THEN 1 ELSE 0 END) as broken,
      SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM promises_tracker WHERE party_id = ?
  `).get(party.id) as Record<string, number>

  // Average composite score
  const avgScore = db.prepare(`
    SELECT ROUND(AVG(score), 1) as avg_score
    FROM score_history WHERE party_id = ? AND score_type = 'composite'
  `).get(party.id) as { avg_score: number | null }

  // Analysis stats from user analyses
  const analysisStats = db.prepare(`
    SELECT
      COUNT(*) as total_analyses,
      ROUND(AVG(CAST(json_extract(analysis_json, '$.nivel_honestidad') AS REAL)), 1) as avg_honesty
    FROM analyses a
    JOIN politicians p ON normalize(a.politician) = normalize(p.display_name)
    WHERE p.party_id = ?
  `).get(party.id) as any

  // Legislation by this party
  const legislationCount = db.prepare(`
    SELECT COUNT(*) as total FROM legislation WHERE governing_party = ?
  `).get(party.short_name || party.name) as { total: number }

  return {
    ...party,
    members: members.map(m => ({
      slug: m.slug,
      name: m.display_name,
      position: m.current_position,
    })),
    promises: {
      total: promiseStats.total || 0,
      kept: promiseStats.kept || 0,
      broken: promiseStats.broken || 0,
      partial: promiseStats.partial || 0,
      pending: promiseStats.pending || 0,
      kept_rate: promiseStats.total > 0
        ? Math.round(((promiseStats.kept || 0) + (promiseStats.partial || 0)) / promiseStats.total * 100)
        : 0,
    },
    composite_score: avgScore.avg_score ?? null,
    analysis_honesty: analysisStats.avg_honesty ?? null,
    total_analyses: analysisStats.total_analyses || 0,
    legislation_count: legislationCount.total || 0,
    total_members: members.length,
  }
}

/**
 * Get enhanced politician profile combining analysis data + seed data
 */
export function getEnhancedPoliticianProfile(slug: string): Record<string, any> | null {
  const db = getDb()

  // Get from seed data first
  const politician = db.prepare(`
    SELECT p.*, pa.slug as party_slug, pa.name as party_name, pa.color as party_color
    FROM politicians p
    LEFT JOIN parties pa ON p.party_id = pa.id
    WHERE p.slug = ?
  `).get(slug) as Record<string, any> | undefined
  if (!politician) return null

  // Get scores from score_history
  const scores = db.prepare(`
    SELECT score_type, score, confidence
    FROM score_history WHERE politician_id = ?
    ORDER BY score_type
  `).all(politician.id) as any[]

  const scoreMap: Record<string, number> = {}
  for (const s of scores) {
    scoreMap[s.score_type] = s.score
  }

  // Get promises
  const promises = db.prepare(`
    SELECT text, topic, status, date_made, date_due, source_description
    FROM promises_tracker WHERE politician_id = ?
    ORDER BY date_made DESC
  `).all(politician.id) as any[]

  const promiseStats = {
    total: promises.length,
    kept: promises.filter(p => p.status === 'kept').length,
    broken: promises.filter(p => p.status === 'broken').length,
    partial: promises.filter(p => p.status === 'partial').length,
    pending: promises.filter(p => p.status === 'pending').length,
    kept_rate: promises.length > 0
      ? Math.round((promises.filter(p => p.status === 'kept' || p.status === 'partial').length / promises.length) * 100)
      : 0,
  }

  // Get legislation related (by party)
  const relatedLegislation = db.prepare(`
    SELECT title, date_published, summary, category
    FROM legislation WHERE governing_party = ?
    ORDER BY date_published DESC LIMIT 5
  `).all(politician.party_name || '') as any[]

  // Get analysis stats
  const analysisStats = db.prepare(`
    SELECT
      COUNT(*) as total_analyses,
      ROUND(AVG(CAST(json_extract(analysis_json, '$.nivel_honestidad') AS REAL)), 1) as avg_honesty,
      MAX(created_at) as last_analysis
    FROM analyses
    WHERE normalize(politician) = normalize(?)
  `).get(politician.display_name) as any

  // Get global avg for comparison
  const globalAvg = db.prepare(`
    SELECT ROUND(AVG(score), 1) as avg_all
    FROM score_history WHERE score_type = 'composite'
  `).get() as { avg_all: number | null }

  return {
    slug: politician.slug,
    name: politician.display_name,
    full_name: politician.full_name,
    party: { slug: politician.party_slug, name: politician.party_name, color: politician.party_color },
    biography: politician.biography,
    birth_date: politician.birth_date,
    current_position: politician.current_position,
    positions: JSON.parse(politician.positions || '[]'),
    source: politician.source,
    scores: {
      composite: scoreMap['composite'] ?? null,
      honesty: scoreMap['honesty'] ?? null,
      promises_kept: scoreMap['promises_kept'] ?? null,
      consistency: scoreMap['consistency'] ?? null,
    },
    composite_score: scoreMap['composite'] ?? null,
    vs_all: {
      avg_all: globalAvg?.avg_all ?? 5.0,
      diff: scoreMap['composite'] ? Math.round((scoreMap['composite'] - (globalAvg?.avg_all ?? 5.0)) * 10) / 10 : 0,
    },
    promises,
    promise_stats: promiseStats,
    related_legislation: relatedLegislation,
    analysis: {
      total_analyses: analysisStats?.total_analyses || 0,
      avg_honesty: analysisStats?.avg_honesty || null,
      last_analysis: analysisStats?.last_analysis || null,
    },
  }
}

/**
 * Get all parties with aggregate stats
 */
export function getAllParties(): any[] {
  const db = getDb()
  const parties = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM politicians p2 WHERE p2.party_id = p.id) as member_count,
      (SELECT ROUND(AVG(score), 1) FROM score_history WHERE party_id = p.id AND score_type = 'composite') as avg_score
    FROM parties p
    ORDER BY member_count DESC
  `).all() as any[]

  return parties.map(p => ({
    slug: p.slug,
    name: p.name,
    short_name: p.short_name,
    color: p.color,
    founded_year: p.founded_year,
    ideology: p.ideology,
    member_count: p.member_count,
    avg_score: p.avg_score ?? null,
  }))
}

/**
 * Get leaderboard combining seed scores with analysis data
 */
export function getEnhancedLeaderboard(): any[] {
  const db = getDb()

  // Combine seeded politicians with analysis-derived ones
  const seeded = db.prepare(`
    SELECT p.slug, p.display_name, pa.slug as party_slug, pa.short_name as party_name,
           pa.color as party_color, p.current_position,
           s.score as composite_score
    FROM politicians p
    LEFT JOIN parties pa ON p.party_id = pa.id
    LEFT JOIN score_history s ON s.politician_id = p.id AND s.score_type = 'composite'
    ORDER BY composite_score DESC
  `).all() as any[]

  return seeded.map((p, i) => ({
    position: i + 1,
    name: p.display_name,
    slug: p.slug,
    party_slug: p.party_slug,
    party: p.party_name || '',
    party_color: p.party_color || '',
    position_title: p.current_position || '',
    composite_score: p.composite_score ?? null,
  }))
}

/**
 * Get global statistics including seed data
 */
export function getEnhancedGlobalStats(): Record<string, any> {
  const db = getDb()

  const seededPoliticians = db.prepare('SELECT COUNT(*) as total FROM politicians').get() as { total: number }
  const totalParties = db.prepare('SELECT COUNT(*) as total FROM parties').get() as { total: number }
  const totalPromises = db.prepare('SELECT COUNT(*) as total FROM promises_tracker').get() as { total: number }
  const totalLegislation = db.prepare('SELECT COUNT(*) as total FROM legislation').get() as { total: number }

  const promiseSummary = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'broken' THEN 1 ELSE 0 END) as broken,
      SUM(CASE WHEN status = 'kept' THEN 1 ELSE 0 END) as kept
    FROM promises_tracker
  `).get() as any

  const avgScore = db.prepare(`
    SELECT ROUND(AVG(score), 1) as avg_all
    FROM score_history WHERE score_type = 'composite'
  `).get() as { avg_all: number | null }

  return {
    seeded_politicians: seededPoliticians.total,
    total_parties: totalParties.total,
    total_promises: totalPromises.total,
    total_legislation_analyzed: totalLegislation.total,
    promise_summary: {
      total: promiseSummary.total || 0,
      broken: promiseSummary.broken || 0,
      kept: promiseSummary.kept || 0,
      broken_rate: promiseSummary.total > 0
        ? Math.round((promiseSummary.broken || 0) / promiseSummary.total * 100)
        : 0,
    },
    avg_composite_score: avgScore.avg_all ?? null,
  }
}

/**
 * Get promise statistics for the promise tracker
 */
export function getPromiseStats(partySlug?: string): any[] {
  const db = getDb()

  const query = partySlug
    ? `SELECT pt.*, p.display_name, p.slug as pol_slug, pa.slug as party_slug, pa.short_name as party_name, pa.color as party_color
       FROM promises_tracker pt
       JOIN politicians p ON pt.politician_id = p.id
       JOIN parties pa ON pt.party_id = pa.id
       WHERE pa.slug = ?
       ORDER BY pt.date_made DESC`
    : `SELECT pt.*, p.display_name, p.slug as pol_slug, pa.slug as party_slug, pa.short_name as party_name, pa.color as party_color
       FROM promises_tracker pt
       JOIN politicians p ON pt.politician_id = p.id
       JOIN parties pa ON pt.party_id = pa.id
       ORDER BY pt.date_made DESC`

  const params = partySlug ? [partySlug] : []
  return db.prepare(query).all(...params) as any[]
}

/**
 * Get party comparison data for visual comparison
 */
export function getPartyComparison(): any[] {
  const db = getDb()

  const parties = db.prepare(`
    SELECT 
      p.id, p.slug, p.name, p.short_name, p.color, p.ideology, p.founded_year,
      COUNT(DISTINCT pol.id) as member_count,
      ROUND(AVG(CASE WHEN sh.score_type = 'composite' THEN sh.score END), 1) as avg_score,
      ROUND(AVG(CASE WHEN sh.score_type = 'promises_kept' THEN sh.score END), 1) as promises_score,
      SUM(CASE WHEN sh.score_type = 'composite' AND sh.score >= 6 THEN 1 ELSE 0 END) as high_count,
      SUM(CASE WHEN sh.score_type = 'composite' AND sh.score >= 4 AND sh.score < 6 THEN 1 ELSE 0 END) as mid_count,
      SUM(CASE WHEN sh.score_type = 'composite' AND sh.score < 4 THEN 1 ELSE 0 END) as low_count,
      (SELECT COUNT(*) FROM promises_tracker WHERE party_id = p.id) as total_promises,
      (SELECT SUM(CASE WHEN status = 'kept' THEN 1 ELSE 0 END) FROM promises_tracker WHERE party_id = p.id) as kept_promises,
      (SELECT SUM(CASE WHEN status = 'broken' THEN 1 ELSE 0 END) FROM promises_tracker WHERE party_id = p.id) as broken_promises
    FROM parties p
    LEFT JOIN politicians pol ON pol.party_id = p.id
    LEFT JOIN score_history sh ON sh.politician_id = pol.id
    GROUP BY p.id
    ORDER BY avg_score DESC
  `).all() as any[]

  return parties.map(p => ({
    slug: p.slug,
    name: p.name,
    short_name: p.short_name || p.name,
    color: p.color || '#888888',
    ideology: p.ideology || '',
    founded_year: p.founded_year,
    member_count: p.member_count || 0,
    avg_score: p.avg_score || null,
    promises_score: p.promises_score || null,
    score_distribution: {
      high: p.high_count || 0,
      mid: p.mid_count || 0,
      low: p.low_count || 0,
    },
    promises: {
      total: p.total_promises || 0,
      kept: p.kept_promises || 0,
      broken: p.broken_promises || 0,
      kept_rate: p.total_promises > 0
        ? Math.round(((p.kept_promises || 0) / p.total_promises) * 100)
        : 0,
    },
  }))
}
