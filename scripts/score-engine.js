#!/usr/bin/env node
/**
 * Score Engine v1 — Recalcula scores compuestos para todos los políticos
 * 
 * Fórmula:
 * - Si hay análisis de usuarios: 60% media análisis + 20% promesas + 20% base
 * - Si NO hay análisis: 40% promesas + 40% base + 20% partido base
 * - Si no hay nada: 5.0 base
 */
const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '..', 'db', 'nomemientas.db'))

const getAnalysis = db.prepare(`
  SELECT id, politician, party, analysis_json FROM analyses
`)

const getPromises = db.prepare(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN status = 'kept' OR status = 'partial' THEN 1 ELSE 0 END) as kept
  FROM promises_tracker WHERE politician_id = ?
`)

const getPartyAvg = db.prepare(`
  SELECT AVG(score) as avg_score FROM score_history 
  WHERE party_id = ? AND score_type = 'composite' AND score != 5.0
`)

const upsertScore = db.prepare(`INSERT OR REPLACE INTO score_history 
  (id, politician_id, score_type, score, confidence, period, source, computed_at)
  VALUES (
    COALESCE((SELECT id FROM score_history WHERE politician_id = ? AND score_type = ? AND period = '2004-2026'), -1),
    ?, ?, ?, ?, '2004-2026', 'score_engine_v1', datetime('now')
  )`)

function normalize(str) {
  if (!str) return ''
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim()
}

// Build analysis map: normalized name -> { avg_honesty, total_analyses }
const allAnalyses = getAnalysis.all()
const analysisMap = {}
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
  analysisMap[key].avg = analysisMap[key].sum / analysisMap[key].count
}

const politicians = db.prepare('SELECT id, display_name, party_id FROM politicians').all()
let calculated = 0

for (const p of politicians) {
  let composite = 5.0
  let honesty = 5.0
  let confidence = 0.3

  // 1. Analysis data
  const polKey = normalize(p.display_name)
  const analysisData = analysisMap[polKey]
  const analysisScore = analysisData?.avg || null
  const analysisCount = analysisData?.count || 0

  // 2. Promises data
  const promises = getPromises.get(p.id)
  const promiseKeptRate = promises?.total > 0 ? (promises.kept || 0) / promises.total : null

  // 3. Party average (if exists)
  const partyAvg = p.party_id ? getPartyAvg.get(p.party_id)?.avg_score : null
  const partyBase = partyAvg || 5.0

  if (analysisCount > 0) {
    // Has user analysis data
    composite = (analysisScore * 0.6)
    if (promiseKeptRate !== null) {
      composite += (promiseKeptRate * 10 * 0.2)  // 20% promise kept rate
    } else {
      composite += (partyBase * 0.2)
    }
    composite += (partyBase * 0.2)  // party base
    composite = Math.round(composite * 10) / 10
    honesty = analysisScore
    confidence = Math.min(0.5 + analysisCount * 0.05, 0.9)
  } else if (promiseKeptRate !== null) {
    // Has promise data
    composite = (promiseKeptRate * 10 * 0.4) + (partyBase * 0.4) + (5.0 * 0.2)
    composite = Math.round(composite * 10) / 10
    honesty = Math.round(composite * 0.9 * 10) / 10
    confidence = 0.4
  } else if (partyBase !== 5.0) {
    composite = Math.round(partyBase * 10) / 10
    honesty = composite
    confidence = 0.3
  }

  composite = Math.max(1, Math.min(10, composite))
  honesty = Math.max(1, Math.min(10, honesty))

  upsertScore.run(p.id, 'composite', p.id, 'composite', composite, confidence)
  upsertScore.run(p.id, 'honesty', p.id, 'honesty', honesty, confidence)
  
  if (promiseKeptRate !== null) {
    const promiseScore = Math.round(promiseKeptRate * 10 * 10) / 10
    upsertScore.run(p.id, 'promises_kept', p.id, 'promises_kept', Math.max(1, Math.min(10, promiseScore)), 0.5)
  }

  calculated++
}

const total = db.prepare('SELECT COUNT(*) as t FROM score_history WHERE score_type = ?').get('composite')
const avg = db.prepare('SELECT AVG(score) as a FROM score_history WHERE score_type = ?').get('composite')

// Show top 10 after recalculation
console.log('=== SCORE ENGINE V1 ===')
console.log(`Recalculated: ${calculated} politicians`)
console.log(`Total scores: ${total.t} | Average: ${Math.round(avg.a * 10) / 10}/10`)
console.log('\nTop 10 after recalculation:')
const top = db.prepare(`
  SELECT p.display_name, s.score, s.confidence, pa.short_name
  FROM score_history s
  JOIN politicians p ON s.politician_id = p.id
  LEFT JOIN parties pa ON p.party_id = pa.id
  WHERE s.score_type = 'composite' AND s.period = '2004-2026'
  ORDER BY s.score DESC LIMIT 10
`).all()
for (const t of top) {
  console.log(`  ${t.score.toFixed(1)}/10  ${t.display_name.padEnd(30)} [${t.short_name||'?'}]  conf:${t.confidence}`)
}

console.log('\nBottom 5:')
const bottom = db.prepare(`
  SELECT p.display_name, s.score, pa.short_name
  FROM score_history s
  JOIN politicians p ON s.politician_id = p.id
  LEFT JOIN parties pa ON p.party_id = pa.id
  WHERE s.score_type = 'composite' AND s.period = '2004-2026'
  ORDER BY s.score ASC LIMIT 5
`).all()
for (const b of bottom) {
  console.log(`  ${b.score.toFixed(1)}/10  ${b.display_name.padEnd(30)} [${b.short_name||'?'}]`)
}

db.close()