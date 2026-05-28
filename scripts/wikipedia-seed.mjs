#!/usr/bin/env node
// Seed masivo de politicos desde Wikipedia API
import https from 'https'
import http from 'http'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(import.meta.dirname, '..', 'db', 'nomemientas.db')
const CACHE_DIR = path.join(import.meta.dirname, '..', '.wiki-cache')
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

const WIKI_API = 'https://es.wikipedia.org/w/api.php'

const PARTY_MAP = {
  'PSOE': 'psoe', 'Partido Socialista Obrero Espa\xf1ol': 'psoe', 'PSC': 'psoe',
  'PP': 'pp', 'Partido Popular': 'pp',
  'Vox': 'vox', 'VOX': 'vox',
  'Sumar': 'sumar',
  'Podemos': 'podemos',
  'ERC': 'erc', 'Esquerra Republicana de Catalunya': 'erc',
  'Junts': 'junts', 'Junts per Catalunya': 'junts', 'JxCat': 'junts',
  'EH Bildu': 'eh-bildu', 'Euskal Herria Bildu': 'eh-bildu',
  'PNV': 'pnv', 'Partido Nacionalista Vasco': 'pnv',
  'CC': 'cc', 'Coalici\xf3n Canaria': 'cc',
  'UPN': 'upn', 'Uni\xf3n del Pueblo Navarro': 'upn',
  'BNG': 'bng', 'Bloque Nacionalista Galego': 'bng',
  'Cs': 'cs', 'Ciudadanos': 'cs',
  'IU': 'iu', 'Izquierda Unida': 'iu',
  'Comprom\xeds': 'sumar',
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    proto.get(url, { headers: { 'User-Agent': 'nomemientas/1.0' } }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error('JSON parse error')) }
      })
    }).on('error', reject)
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await fetchJson(url) }
    catch (e) {
      if (i === retries - 1) throw e
      await sleep(1000 * (i + 1))
    }
  }
}

async function getCategoryMembers(category, limit = 500) {
  const titles = []
  let cont = null
  while (titles.length < limit) {
    const params = new URLSearchParams({
      action: 'query', format: 'json', list: 'categorymembers',
      cmtitle: 'Categor\xeda:' + category, cmlimit: 'max', cmtype: 'page',
    })
    if (cont) params.set('cmcontinue', cont)
    const data = await fetchWithRetry(WIKI_API + '?' + params)
    const members = data.query?.categorymembers || []
    for (const m of members) {
      if (m.ns === 0) titles.push(m.title)
    }
    cont = data.continue?.cmcontinue || null
    if (!cont) break
    await sleep(250)
  }
  return titles.slice(0, limit)
}

async function getExtracts(titles) {
  const results = {}
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    const params = new URLSearchParams({
      action: 'query', format: 'json', prop: 'extracts',
      exintro: '1', explaintext: '1', exlimit: 'max',
      titles: batch.join('|'),
    })
    const data = await fetchWithRetry(WIKI_API + '?' + params)
    const pages = data.query?.pages || {}
    for (const id of Object.keys(pages)) {
      if (id === '-1') continue
      const page = pages[id]
      results[page.title] = (page.extract || '').slice(0, 1000)
    }
    await sleep(300)
    process.stdout.write('.')
    if ((i + 50) % 500 === 0) console.log(' ' + (i + 50) + '/' + titles.length)
  }
  console.log('')
  return results
}

async function getStructuredData(title) {
  const result = { party: null, positions: [] }
  try {
    const params = new URLSearchParams({
      action: 'parse', format: 'json', page: title,
      prop: 'text', section: '0', disablelimitreport: '1',
    })
    const data = await fetchWithRetry(WIKI_API + '?' + params)
    const html = data.parse?.text?.['*'] || ''

    // Extract party from infobox
    const partyMatch = html.match(/Partido pol\xedtico[^<]*<[^>]+>([^<]+)</i)
    if (partyMatch) {
      const pn = partyMatch[1].trim()
      for (const [name, slug] of Object.entries(PARTY_MAP)) {
        if (pn.includes(name) || name.includes(pn)) {
          result.party = slug; break
        }
      }
    }

    // Extract positions
    const posRegex = /<th[^>]*>(?:Cargo|President[ea]|Ministro|Diputado|Senador|Alcalde|Consejero|Vicepresident[ea]|Portavoz|Secretari[oa])[^<]*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi
    let m
    while ((m = posRegex.exec(html)) !== null) {
      const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (text && text.length < 150) result.positions.push(text)
    }
  } catch {}
  return result
}

function makeSlug(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function main() {
  console.log('=== WIKIPEDIA SEED: POLITICIANS ===\n')

  // Step 1: Get members from key categories
  console.log('[1/4] Fetching category members...')
  const allTitles = new Set()
  const categories = [
    'Pol\xedticos de Espa\xf1a del siglo XXI',
    'Ministros de Espa\xf1a del siglo XXI',
    'Presidentes auton\xf3micos de Espa\xf1a',
    'Diputados de las Cortes Generales',
    'Alcaldes de Espa\xf1a del siglo XXI',
    'Diputados del Parlamento Europeo de Espa\xf1a',
  ]
  for (const cat of categories) {
    try {
      process.stdout.write('  ' + cat + '... ')
      const members = await getCategoryMembers(cat, 200)
      for (const m of members) allTitles.add(m)
      console.log(members.length + ' pages (total: ' + allTitles.size + ')')
      await sleep(500)
    } catch (e) { console.log('  [ERROR] ' + cat + ': ' + e.message) }
  }

  // Filter
  let titles = [...allTitles]
  const skip = ['Categor\xeda', 'Plantilla', 'Usuario', 'Anexo', 'Discusi\xf3n', 'M\xf3dulo', 'Ayuda', 'Archivo', 'Wikiproyecto']
  titles = titles.filter(t => !skip.some(p => t.startsWith(p)))
  titles = titles.filter(t => !t.includes('(desambiguaci\xf3n)'))
  titles = titles.slice(0, 350)
  console.log('\n  Filtered to ' + titles.length + ' unique politicians\n')

  // Step 2: Get extracts
  console.log('[2/4] Fetching extracts (batch of 50)...')
  const extracts = await getExtracts(titles)
  console.log('  Got extracts for ' + Object.keys(extracts).length + ' pages\n')

  // Step 3: Get structured data
  console.log('[3/4] Fetching structured data from infoboxes...')
  const topTitles = titles.slice(0, 250)
  const structData = {}
  for (let i = 0; i < topTitles.length; i++) {
    await sleep(350)
    try {
      structData[topTitles[i]] = await getStructuredData(topTitles[i])
    } catch {
      structData[topTitles[i]] = { party: null, positions: [] }
    }
    if ((i + 1) % 25 === 0) console.log('  [INFOBOX] ' + (i + 1) + '/' + topTitles.length)
  }

  // Step 4: Insert
  console.log('\n[4/4] Inserting into database...')
  const insertPol = db.prepare(`INSERT OR IGNORE INTO politicians 
    (slug, full_name, display_name, party_id, biography, current_position, positions, source, source_data)
    VALUES (?, ?, ?, (SELECT id FROM parties WHERE slug = ?), ?, ?, ?, 'wikipedia', ?)`)

  let inserted = 0, skipped = 0
  for (const title of topTitles) {
    const extract = extracts[title] || ''
    const info = structData[title] || { party: null, positions: [] }
    if (!extract) { skipped++; continue }

    // Extract party from text if not from infobox
    let party = info.party
    if (!party) {
      const pm = extract.match(/(?:miembro del|militante del|perteneciente al|del partido|del) ([A-Z\xc1\xc9\xcd\xd3\xda\xd1][A-Za-z\xe1\xe9\xed\xf3\xfa\xf1\s]{2,50})/i)
      if (pm) {
        const cand = pm[1].trim()
        for (const [name, slug] of Object.entries(PARTY_MAP)) {
          if (cand.includes(name) || name.includes(cand)) { party = slug; break }
        }
      }
    }

    const slug = makeSlug(title)
    const bio = extract.slice(0, 2000)
    const srcData = JSON.stringify({ wiki_title: title })

    try {
      insertPol.run(slug, title, title, party || null, bio, info.positions[0] || '', JSON.stringify(info.positions), srcData)
      inserted++
    } catch { skipped++ }
  }

  console.log(`\n=== RESULTS ===`)
  console.log(`  Total found: ${titles.length}`)
  console.log(`  Inserted: ${inserted}`)
  console.log(`  Skipped: ${skipped}`)
  const total = db.prepare('SELECT COUNT(*) as total FROM politicians').get()
  console.log(`  Total politicians in DB: ${total.total}`)

  // Generate default scores
  console.log('\n  Generating default scores...')
  const insertScore = db.prepare(`INSERT OR IGNORE INTO score_history 
    (politician_id, score_type, score, confidence, period, source)
    VALUES (?, ?, ?, ?, '2004-2026', 'wikipedia_default')`)

  const newPols = db.prepare(`SELECT id FROM politicians WHERE source = 'wikipedia' 
    AND id NOT IN (SELECT politician_id FROM score_history WHERE score_type = 'composite')`).all()
  for (const p of newPols) {
    insertScore.run(p.id, 'composite', 5.0, 0.3)
    insertScore.run(p.id, 'honesty', 5.0, 0.3)
  }
  console.log(`  Default scores for ${newPols.length} new politicians`)

  db.close()
  console.log('\nDone!')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })