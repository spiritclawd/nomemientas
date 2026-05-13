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

      CREATE INDEX IF NOT EXISTS idx_url ON analyses(url);
      CREATE INDEX IF NOT EXISTS idx_created ON analyses(created_at DESC);
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

export interface AnalysisRecord {
  id: number
  url: string
  source_type: string
  politician: string
  party: string
  analysis_json: string
  created_at: string
}

export function getRecentAnalyses(limit = 20): AnalysisRecord[] {
  const db = getDb()
  return db.prepare(`
    SELECT id, url, source_type, politician, party, analysis_json, created_at
    FROM analyses
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as AnalysisRecord[]
}

export function getAnalysisById(id: number): Record<string, any> | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM analyses WHERE id = ?').get(id)
  return row || null
}
