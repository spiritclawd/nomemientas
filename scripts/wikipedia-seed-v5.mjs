#!/usr/bin/env node
/**
 * Wikipedia seed v5 — OpenSearch fuzzy search + batch fetch
 * 
 * Adds 70+ Spanish politicians using Wikipedia OpenSearch API for fuzzy title resolution,
 * then batch fetches extracts in groups of 50, inserts into DB with party detection.
 */
import https from 'https'
import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(import.meta.dirname, '..', 'db', 'nomemientas.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

const WIKI_API = 'https://es.wikipedia.org/w/api.php'

const PARTY_MAP = [
  [/PSOE|PSC|Partido Socialista|Socialista Obrero/i, 'psoe'],
  [/Partido Popular|PP$/i, 'pp'],
  [/Vox|VOX/i, 'vox'],
  [/Sumar|Movimiento Sumar/i, 'sumar'],
  [/Podemos|Unidas Podemos/i, 'podemos'],
  [/ERC|Esquerra/i, 'erc'],
  [/Junts|Junts per Catalunya|JxCat/i, 'junts'],
  [/EH Bildu|Euskal Herria Bildu/i, 'eh-bildu'],
  [/PNV|Partido Nacionalista Vasco|EAJ-PNV/i, 'pnv'],
  [/CC|Coalición Canaria|Coalici.n Canaria/i, 'cc'],
  [/UPN|Unión del Pueblo Navarro|Uni.n del Pueblo Navarro/i, 'upn'],
  [/BNG|Bloque Nacionalista Galego/i, 'bng'],
  [/Cs|Ciudadanos|Ciutadans/i, 'cs'],
  [/IU|Izquierda Unida/i, 'iu'],
  [/Compromís|Més Compromís|Comprom.s|M.s Comprom.s/i, 'sumar'],
]

// Manual wiki title overrides for names that need disambiguation or are known
const MANUAL_TITLES = {
  'Tomás Gómez': 'Tomás Gómez (político)',
  'Rafael Hernando': 'Rafael Hernando (político)',
  'Fernández de la Vega': 'María Teresa Fernández de la Vega',
  'Alberto Rodríguez del Pino': 'Alberto Rodríguez (político)',
  'Mariano Rajoy Brey': 'Mariano Rajoy',
  'Juan Manuel Moreno Bonilla': 'Juanma Moreno',
}

// Full-name variants that are dupes of already-present politicians
const DUPES_FULL = new Set([
  'Felipe González Márquez',
  'José María Aznar López',
  'Manuel Fraga Iribarne',
])

// Non-Spanish / invalid
const SKIP_NAMES = new Set([
  'Simone Veil',
  'Himself',
])

const NEW_NAMES = [
  // === More PSOE (21) ===
  'Rafael Simancas',
  'Tomás Gómez',
  'Odón Elorza',
  'Eduardo Madina',
  'Juan Carlos Rodríguez Ibarra',
  'José María Benegas',
  'Ramón Rubial',
  'Jesús Quijano',
  'Emilio Pérez Touriño',
  'Fernández de la Vega',
  'Bernat Soria',
  'Cristina Alberdi',
  'Jordi Sevilla',
  'José Antonio Alonso',
  'Gregorio Peces-Barba',
  'Elena Salgado',
  'Miguel Boyer',
  'Carlos Solchaga',
  'Antoni Castells',
  'Isabel Tocino',
  'Javier Solana Madariaga',

  // === More PP (18) ===
  'Francisco Camps',
  'Eduardo Zaplana',
  'José María Michavila',
  'Carlos Aragonés',
  'Rafael Arias-Salgado',
  'Luis de Grandes',
  'Celso Villalibre',
  'Alberto Ruiz-Gallardón',
  'Ángel Acebes',
  'Mariano Rajoy Brey',
  'Juan Costa Climent',
  'José Manuel García-Margallo',
  'Federico Trillo-Figueroa',
  'Luis de la Vega',
  'César Antonio Molina',
  'Pío García-Escudero',
  'Pedro Antonio de la Rosa',

  // === More Vox (3) ===
  'Manuel Mariscal',
  'Rodrigo Alonso',
  'Carmen Lobo',

  // === More Podemos (5) ===
  'Rafa Mayoral',
  'Pablo Echenique',
  'Sofía Castañón',
  'Noelia Vera',
  'Alberto Rodríguez del Pino',

  // === More ERC (5) ===
  'Joan Tardà',
  'Carles Mundó',
  'Roger Torrent',
  'Carme Forcadell',
  'Anna Gabriel',

  // === More PNV (3) ===
  'José María Ajuriaguerra',
  'Iñaki Anasagasti',
  'Jon Jauregi',

  // === More Regional (7) ===
  'Fernando López Miras',
  'Jorge Azcón',
  'María Guardiola',
  'Juan Manuel Moreno Bonilla',
  'Gonzalo Jácome',
  'Iago Negueruela',
  'Matías Alonso',

  // === Historical (8) ===
  'Manuel Azaña',
  'Adolfo Suárez',
  'Leopoldo Calvo-Sotelo',
  'Santiago Carrillo',
  'Alfonso Guerra',
  'Francisco Frutos',
  'Julio Anguita',
  'Nicolás Sartorius',
]

// === HELPERS ===

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'nomemientas/1.0' } }, (res) => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        if (res.statusCode === 429) {
          const retryAfter = parseInt(res.headers['retry-after'] || '30', 10)
          reject(Object.assign(new Error(`HTTP 429: rate limited. Retry-After: ${retryAfter}s`), { retryAfter, statusCode: 429 }))
        } else if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${d.slice(0, 200)}`))
        } else {
          try { resolve(JSON.parse(d)) } catch(e) { reject(new Error(`JSON parse error: ${d.slice(0, 100)}`)) }
        }
      })
    }).on('error', reject)
  })
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchJson(url)
    } catch (e) {
      if (e.statusCode === 429) {
        const wait = (e.retryAfter || 30) + 2
        console.log(`  ⏳ Rate limited, waiting ${wait}s...`)
        await sleep(wait * 1000)
        continue
      }
      if (i < retries - 1) {
        const backoff = 1000 * (i + 1) * 2
        console.log(`  ⏳ Retry ${i+1}/${retries} after ${backoff}ms: ${e.message}`)
        await sleep(backoff)
        continue
      }
      throw e
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function makeSlug(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function detectParty(text) {
  for (const [pattern, slug] of PARTY_MAP) {
    if (pattern.test(text)) return slug
  }
  return null
}

async function openSearch(name) {
  const params = new URLSearchParams({
    action: 'opensearch', format: 'json', search: name, limit: '1', namespace: '0',
  })
  const data = await fetchWithRetry(WIKI_API + '?' + params, 2)
  const titles = data[1] || []
  if (titles.length > 0 && titles[0].length < 80) {
    return titles[0]
  }
  return null
}

async function main() {
  console.log('=== WIKIPEDIA SEED V5 ===\n')
  const start = Date.now()

  // Build final list: filter skips and dupes
  const finalNames = NEW_NAMES.filter(n => {
    if (SKIP_NAMES.has(n)) {
      console.log(`  Skip (invalid/non-Spanish): ${n}`)
      return false
    }
    if (DUPES_FULL.has(n)) {
      console.log(`  Skip (dupe full-name): ${n}`)
      return false
    }
    return true
  })

  console.log(`  Target names after filtering: ${finalNames.length}`)

  // Check existing slugs
  const existingSlugs = new Set(db.prepare('SELECT slug FROM politicians').all().map(r => r.slug))
  const toProcess = finalNames.filter(n => {
    if (existingSlugs.has(makeSlug(n))) {
      console.log(`  Skip (already in DB): ${n}`)
      return false
    }
    return true
  })
  console.log(`  New (not already in DB): ${toProcess.length} / ${finalNames.length}\n`)

  if (toProcess.length === 0) {
    console.log('Nothing new to add. Done.')
    db.close()
    return
  }

  // Step 1: OpenSearch for each name
  console.log('[1/3] OpenSearch API — resolving Wikipedia page titles...')
  const pageTitles = new Map()  // wikiTitle -> originalName

  for (let i = 0; i < toProcess.length; i++) {
    const name = toProcess[i]

    // Check manual override first
    if (MANUAL_TITLES[name]) {
      pageTitles.set(MANUAL_TITLES[name], name)
      if ((i + 1) % 20 === 0) process.stdout.write('.')
      continue
    }

    try {
      const wikiTitle = await openSearch(name)
      if (wikiTitle) {
        pageTitles.set(wikiTitle, name)
      } else {
        console.log(`  ⚠ No Wikipedia page found for: ${name}`)
      }
    } catch (e) {
      console.log(`  ⚠ OpenSearch error for ${name}: ${e.message}`)
    }
    await sleep(800)  // rate limit between searches
    if ((i + 1) % 15 === 0) process.stdout.write('.')
  }

  console.log(`\n  Resolved ${pageTitles.size} / ${toProcess.length} names to Wikipedia pages\n`)

  if (pageTitles.size === 0) {
    console.log('No pages resolved. Exiting.')
    db.close()
    return
  }

  // Step 2: Batch fetch extracts (50 at a time)
  console.log('[2/3] Batch fetching extracts (50/batch)...')
  const extracts = {}
  const allTitles = [...pageTitles.keys()]
  const totalBatches = Math.ceil(allTitles.length / 50)

  for (let i = 0; i < allTitles.length; i += 50) {
    const batch = allTitles.slice(i, i + 50)
    const batchNum = Math.floor(i / 50) + 1
    try {
      const params = new URLSearchParams({
        action: 'query', format: 'json', prop: 'extracts',
        exintro: '1', explaintext: '1', exlimit: 'max',
        titles: batch.join('|'),
      })
      const data = await fetchWithRetry(WIKI_API + '?' + params, 3)
      const pages = data.query?.pages || {}
      for (const id of Object.keys(pages)) {
        if (id === '-1') continue
        const p = pages[id]
        extracts[p.title] = (p.extract || '').slice(0, 1500)
      }
      console.log(`  Batch ${batchNum}/${totalBatches}: got ${Object.keys(pages).length} pages`)
    } catch (e) {
      console.log(`  ⚠ Batch ${batchNum}/${totalBatches} error after retries: ${e.message}`)
    }
    if (i + 50 < allTitles.length) {
      await sleep(1500)  // longer rate limit between batch calls
    }
  }

  console.log(`  Got extracts for ${Object.keys(extracts).length} pages\n`)

  // Step 3: Insert into DB
  console.log('[3/3] Inserting into database...')
  const insertPol = db.prepare(`INSERT OR IGNORE INTO politicians 
    (slug, full_name, display_name, party_id, biography, source)
    VALUES (?, ?, ?, (SELECT id FROM parties WHERE slug = ?), ?, 'wikipedia')`)

  let inserted = 0, skipped = 0, noExtract = 0

  for (const [wikiTitle, origName] of pageTitles) {
    const slug = makeSlug(origName)
    if (existingSlugs.has(slug)) { skipped++; continue }

    const extract = extracts[wikiTitle]
    if (!extract || extract.length < 20) { noExtract++; continue }

    const party = detectParty(extract)
    const bio = extract.slice(0, 1500)

    try {
      insertPol.run(slug, wikiTitle, origName, party, bio)
      inserted++
    } catch (e) {
      skipped++
      if (inserted === 0) console.log(`  First insert error: ${e.message}`)
    }
  }

  const total = db.prepare('SELECT COUNT(*) as total FROM politicians').get()
  const wikiCount = db.prepare("SELECT COUNT(*) as total FROM politicians WHERE source='wikipedia'").get()

  console.log(`\n=== INSERT RESULTS ===`)
  console.log(`  Resolved pages: ${allTitles.length}`)
  console.log(`  Inserted (new): ${inserted}`)
  console.log(`  No extract (skipped): ${noExtract}`)
  console.log(`  Other skipped: ${skipped}`)
  console.log(`  Total seeded (wikipedia): ${wikiCount.total}`)
  console.log(`  Total all politicians: ${total.total}`)

  // Add default scores
  console.log(`\n  Generating default scores...`)
  const insertScore = db.prepare(`INSERT OR IGNORE INTO score_history 
    (politician_id, score_type, score, confidence, period, source)
    VALUES (?, ?, ?, ?, '2004-2026', 'wikipedia_default')`)

  const newPols = db.prepare(`SELECT id FROM politicians WHERE source = 'wikipedia' 
    AND id NOT IN (SELECT politician_id FROM score_history WHERE score_type = 'composite')`).all()

  for (const p of newPols) {
    insertScore.run(p.id, 'composite', 5.0, 0.3)
    insertScore.run(p.id, 'honesty', 5.0, 0.3)
  }

  console.log(`  Default scores for ${newPols.length} politicians`)

  db.close()
  console.log(`\nDone! (${Math.round((Date.now() - start) / 1000)}s)`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })