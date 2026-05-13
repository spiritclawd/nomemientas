import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'db', 'nomemientas.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbDir = path.join(process.cwd(), 'db')
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')

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

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        analysis_id INTEGER,
        event_type TEXT NOT NULL,
        event_data TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_url ON analyses(url);
      CREATE INDEX IF NOT EXISTS idx_created ON analyses(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_event_type ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_event_analysis ON events(analysis_id);
      CREATE INDEX IF NOT EXISTS idx_event_date ON events(created_at DESC);
    `)
  }
  return db
}

export function saveAnalysis(url: string, sourceText: string, analysisJson: string, sourceType = 'url', rawContent = '') {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO analyses (url, source_type, source_text, raw_content, analysis_json)
    VALUES (?, ?, ?, ?, ?)
  `)
  return stmt.run(url, sourceType, sourceText, rawContent, analysisJson).lastInsertRowid
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
    // Fail silently — tracking is non-critical
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

export function getLeaderboard(): any[] {
  const db = getDb()
  // Group by politician mention in the analysis, get count + avg honesty
  return db.prepare(`
    SELECT
      politician,
      COUNT(*) as total_checks,
      ROUND(AVG(CAST(json_extract(analysis_json, '$.nivel_honestidad') AS REAL)), 1) as avg_honesty,
      MAX(created_at) as last_seen,
      json_extract(analysis_json, '$.traduccion_llana') as latest_translation
    FROM analyses
    WHERE politician != '' AND politician != 'Desconocido'
    GROUP BY politician
    ORDER BY total_checks DESC
    LIMIT 20
  `).all()
}

export function getAnalysisById(id: number): Record<string, any> | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM analyses WHERE id = ?').get(id)
  return row || null
}
