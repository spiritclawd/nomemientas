#!/usr/bin/env node
/**
 * Score Engine v2 — Fixed party average + promise scoring
 * 
 * Fórmula:
 * - Promesas cumplidas: +1 punto cada una
 * - Promesas rotas: -1.5 puntos cada una  
 * - Promesas pendientes: neutro
 * - Promesas parciales: +0.5 puntos cada una
 * - Análisis de usuarios: media directa
 * - Partido base: media del partido
 */
const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '..', 'db', 'nomemientas.db'))

function normalize(str) {
  if (!str) return ''
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

// Step 1: Compute party averages from CURRENT score history (before we overwrite)
const partyAvgs = {}
const partyRows = db.prepare(`
  SELECT pa.id, AVG(sh.score) as avg_score
  FROM score_history sh
  JOIN parties pa ON sh.party_id = pa.id
  WHERE sh.score_type = 'composite' AND sh.score != 5.0
  GROUP BY pa.id
`).all()
for (const r of partyRows) {
  partyAvgs[r.id] = r.avg_score
}

// Step 2: Build analysis map
const analysisMap = {}
const allAnalyses = db.prepare('SELECT politician, analysis_json FROM analyses').all()
for (const a of allAnalyses) {
  const key = normalize(a.politician)
  if (!key || key === 'desconocido') continue
  if (!analysisMap[key]) analysisMap[key] = { sum: 0, count: 0 }
  const h = JSON.parse(a.analysis_json || '{}').nivel_honestidad
  if (h != null && typeof h === 'number') {
    analysisMap[key].sum += h
    analysisMap[key].count++
  }
}
for (const key of Object.keys(analysisMap)) {
  analysisMap[key].avg = Math.round(analysisMap[key].sum / analysisMap[key].count * 10) / 10
}

// Step 3: Score each politician
const upsert = db.prepare(`INSERT OR REPLACE INTO score_history 
  (id, politician_id, score_type, score, confidence, period, source, computed_at)
  VALUES (
    COALESCE((SELECT id FROM score_history WHERE politician_id = ? AND score_type = ? AND period = '2004-2026'), -1),
    ?, ?, ?, ?, '2004-2026', 'score_engine_v2', datetime('now')
  )`)

// Party seed adjustment (from manually curated initial scores)
const PARTY_SEED_ADJUSTMENT = {
  1: 0.5,   // PSOE: Sánchez 5.1, Illa 5.8 → ~5.45 → +0.45
  2: 0.2,   // PP: Feijóo 5.5, Ayuso 4.8 → ~5.15 → +0.15
  3: -1.5,  // Vox: Abascal 3.5 → -1.5
  4: 1.0,   // Sumar: Yolanda 6.0 → +1.0
  5: -0.3,  // Podemos: Iglesias 4.5 → -0.5 (rounded)
  6: 0.0,   // ERC: no seed → 0
  7: -1.8,  // Junts: Puigdemont 3.2 → -1.8
  8: 0.0,   // EH Bildu → 0
  9: -0.3,  // PNV → 0
  10: -0.5, // CC → 0
  11: 0.0,  // UPN → 0
  12: 0.0,  // BNG → 0
  13: -0.3, // Cs → 0
  14: -0.5, // IU → 0
}

const politicians = db.prepare('SELECT id, display_name, party_id FROM politicians').all()

for (const p of politicians) {
  // Analysis data
  const ad = analysisMap[normalize(p.display_name)]
  const analysisScore = ad?.avg || null
  const analysisCount = ad?.count || 0

  // Promise data
  const promRows = db.prepare('SELECT status FROM promises_tracker WHERE politician_id = ?').all(p.id)
  let promiseScore = 0
  let totalWeighted = 0
  for (const pr of promRows) {
    if (pr.status === 'kept') { promiseScore += 1; totalWeighted += 1 }
    else if (pr.status === 'partial') { promiseScore += 0.5; totalWeighted += 1 }
    else if (pr.status === 'broken') { promiseScore -= 1.5; totalWeighted += 1 }
    // pending: neutral
  }
  const hasPromises = totalWeighted > 0

  // Party base from pre-computed averages
  const partyBase = p.party_id && partyAvgs[p.party_id] ? partyAvgs[p.party_id] : 5.0

  let composite = 5.0
  let confidence = 0.3

  if (analysisCount > 0 && hasPromises) {
    composite = (analysisScore * 0.5) + ((5 + promiseScore) * 0.3) + (partyBase * 0.2)
    confidence = 0.6
  } else if (analysisCount > 0) {
    composite = (analysisScore * 0.7) + (partyBase * 0.3)
    confidence = 0.5 + Math.min(analysisCount * 0.05, 0.4)
  } else if (hasPromises) {
    composite = ((5 + promiseScore) * 0.5) + (partyBase * 0.5)
    confidence = 0.4
  } else {
    composite = partyBase + (PARTY_SEED_ADJUSTMENT[p.party_id] || 0)
    confidence = 0.3
  }

  composite = Math.round(Math.max(1, Math.min(10, composite)) * 10) / 10

  upsert.run(p.id, 'composite', p.id, 'composite', composite, confidence)

  if (analysisScore) {
    upsert.run(p.id, 'honesty', p.id, 'honesty', analysisScore, confidence)
  }

  if (hasPromises) {
    const pScore = Math.round(Math.max(1, Math.min(10, 5 + promiseScore)) * 10) / 10
    upsert.run(p.id, 'promises_kept', p.id, 'promises_kept', pScore, 0.5)
  }
}

// Results
const total = db.prepare('SELECT COUNT(*) as t FROM score_history WHERE score_type = ?').get('composite')
const avg = db.prepare('SELECT AVG(score) as a FROM score_history WHERE score_type = ?').get('composite')

console.log('=== SCORE ENGINE V2 ===')
console.log(`Politicians: ${politicians.length} | Scores: ${total.t} | Avg: ${Math.round(avg.a * 10) / 10}/10`)

console.log('\nTop 10:')
const top = db.prepare(`
  SELECT p.display_name, s.score, s.confidence, pa.short_name
  FROM score_history s JOIN politicians p ON s.politician_id = p.id
  LEFT JOIN parties pa ON p.party_id = pa.id
  WHERE s.score_type = 'composite' AND s.period = '2004-2026'
  ORDER BY s.score DESC LIMIT 10
`).all()
for (const t of top) console.log(`  ${t.score.toFixed(1)}/10  ${t.display_name.padEnd(30)} [${t.short_name||'?'}]  conf:${t.confidence}`)

console.log('\nBottom 5:')
const bot = db.prepare(`
  SELECT p.display_name, s.score, pa.short_name
  FROM score_history s JOIN politicians p ON s.politician_id = p.id
  LEFT JOIN parties pa ON p.party_id = pa.id
  WHERE s.score_type = 'composite' AND s.period = '2004-2026'
  ORDER BY s.score ASC LIMIT 5
`).all()
for (const b of bot) console.log(`  ${b.score.toFixed(1)}/10  ${b.display_name.padEnd(30)} [${b.short_name||'?'}]`)

console.log('\nParty averages:')
for (const [id, avgSc] of Object.entries(partyAvgs)) {
  const name = db.prepare('SELECT short_name FROM parties WHERE id = ?').get(parseInt(id))
  if (name) console.log(`  ${name.short_name.padEnd(8)} ${avgSc.toFixed(1)}/10`)
}

db.close()