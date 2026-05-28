#!/usr/bin/env node
// R3 — fix party detection + batch fetch
import https from 'https'
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'db', 'nomemientas.db')
const db = new Database(DB_PATH)

const WIKI_API = 'https://es.wikipedia.org/w/api.php'
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'nomemientas/1.0' } }, (res) => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
    }).on('error', reject)
  })
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function makeSlug(name) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const PARTY_RULES = [
  { re: /Socialista Obrero|PSOE|PSC\b/i, slug: 'psoe' },
  { re: /Partido Popular|\bPP\b(?! de)/i, slug: 'pp' },
  { re: /\bVox\b|VOX/i, slug: 'vox' },
  { re: /\bSumar\b/i, slug: 'sumar' },
  { re: /\bPodemos\b/i, slug: 'podemos' },
  { re: /Esquerra Republicana|ERC\b/i, slug: 'erc' },
  { re: /\bJunts\b|Junts per Catalunya/i, slug: 'junts' },
  { re: /Euskal Herria Bildu|EH Bildu/i, slug: 'eh-bildu' },
  { re: /Partido Nacionalista Vasco|PNV\b/i, slug: 'pnv' },
  { re: /Coalicion Canaria|CC\b/i, slug: 'cc' },
  { re: /Union del Pueblo Navarro/i, slug: 'upn' },
  { re: /Bloque Nacionalista Galego|BNG\b/i, slug: 'bng' },
  { re: /\bCiudadanos\b|Ciutadans\b/i, slug: 'cs' },
  { re: /Izquierda Unida\b/i, slug: 'iu' },
]

function detectParty(text) {
  if (!text) return null
  const s = text.split('.')[0] || text
  for (const r of PARTY_RULES) {
    if (r.re.test(s) || r.re.test(text.slice(0, 200))) return r.slug
  }
  return null
}

async function main() {
  console.log('=== R3: Fix parties + fetch more ===\n')

  // Fix existing
  console.log('[1/4] Fixing party assignments...')
  const rows = db.prepare("SELECT id, full_name, biography FROM politicians").all()
  const update = db.prepare("UPDATE politicians SET party_id = (SELECT id FROM parties WHERE slug = ?) WHERE id = ?")
  let fixed = 0
  for (const r of rows) {
    const slug = detectParty(r.biography)
    if (slug) { update.run(slug, r.id); fixed++ }
  }
  const withParty = db.prepare("SELECT COUNT(*) as t FROM politicians WHERE party_id IS NOT NULL").get()
  console.log(`  Fixed: ${fixed} | With party: ${withParty.t}\n`)

  const existingSlugs = new Set(db.prepare('SELECT slug FROM politicians').all().map(r => r.slug))

  // Fetch more — this time just 50 more top names
  const MORE = {
    'Ramón Jáuregui': 'Ramón Jáuregui',
    'Txiki Benegas': 'Txiki Benegas',
    'Nicolás Redondo Terreros': 'Nicolás Redondo Terreros',
    'Jaume Asens': 'Jaume Asens',
    'Pablo Echenique': 'Pablo Echenique',
    'María José Català': 'María José Català',
    'Francisco Álvarez-Cascos': 'Francisco Álvarez-Cascos',
    'Manuel Fraga': 'Manuel Fraga',
    'Xabier Arzalluz': 'Xabier Arzalluz',
    'Francisco Laborda': 'Francisco Laborda',
    'Fátima Báñez': 'Fátima Báñez',
    'José Manuel Soria': 'José Manuel Soria',
    'Isabel García Tejerina': 'Isabel García Tejerina',
    'Íñigo Méndez de Vigo': 'Íñigo Méndez de Vigo',
    'Román Escolano': 'Román Escolano',
    'María Reyes Maroto': 'María Reyes Maroto',
    'Luis Alberto de Cuenca': 'Luis Alberto de Cuenca',
    'Juan Carlos Campo': 'Juan Carlos Campo',
    'Manuel Castells': 'Manuel Castells',
    'Joan Subirats': 'Joan Subirats',
    'José Manuel Franco Pardo': 'José Manuel Franco Pardo',
    'Luis Tudanca': 'Luis Tudanca',
    'Marta Rivera de la Cruz': 'Marta Rivera de la Cruz',
    'Silvia Clemente': 'Silvia Clemente',
    'Pío García-Escudero': 'Pío García-Escudero',
    'Juan Vicente Herrera': 'Juan Vicente Herrera',
    'Margarita Prohens': 'Margarita Prohens',
    'Francisco de la Torre': 'Francisco de la Torre (político)',
    'Juan Marín': 'Juan Marín',
    'Albert Batet': 'Albert Batet',
    'Núria Marín': 'Núria Marín',
    'Rafael Arias-Salgado': 'Rafael Arias-Salgado',
    'Loyola de Palacio': 'Loyola de Palacio',
    'José María Álvarez del Manzano': 'José María Álvarez del Manzano',
    'José María de la Jara': 'José María de la Jara',
    'Jesús Posada': 'Jesús Posada',
    'Pedro Sanz': 'Pedro Sanz',
    'Alberto Núñez Feijóo': 'Alberto Núñez Feijóo',
    'Pablo Zuloaga': 'Pablo Zuloaga',
    'Raquel Sánchez': 'Raquel Sánchez',
    'Javier Arenas': 'Javier Arenas',
  }

  const entries = Object.entries(MORE).filter(([n]) => !existingSlugs.has(makeSlug(n)))
  console.log(`[2/4] ${entries.length} new to fetch\n`)

  if (entries.length > 0) {
for (let i = 0; i < entries.length; i += 20) {
    const batch = entries.slice(i, i + 20)
      const params = new URLSearchParams({
        action: 'query', format: 'json', prop: 'extracts',
        exintro: '1', explaintext: '1', exlimit: '20',
        titles: batch.map(([_, t]) => t).join('|'),
      })
      try {
        const data = await fetchJson(WIKI_API + '?' + params)
        const pages = data.query?.pages || {}
        const results = {}
        for (const id of Object.keys(pages)) {
          if (id === '-1') continue
          const p = pages[id]; results[p.title] = (p.extract || '').slice(0, 1500)
        }
        const ins = db.prepare(`INSERT OR IGNORE INTO politicians 
          (slug, full_name, display_name, party_id, biography, source)
          VALUES (?, ?, ?, (SELECT id FROM parties WHERE slug = ?), ?, 'wikipedia')`)
        let cnt = 0
        for (const [name, wt] of batch) {
          const ext = results[wt]
          if (!ext || ext.length < 3) continue
          try { ins.run(makeSlug(name), wt, name, detectParty(ext), ext.slice(0, 1500)); cnt++ } catch {}
        }
        console.log(`  Batch ${Math.floor(i/50)+1}: +${cnt}`)
      } catch (e) { console.log('  Error:', e.message) }
      await sleep(800)
    }
  }

  console.log()
  const total = db.prepare('SELECT COUNT(*) as t FROM politicians').get()
  const wp = db.prepare("SELECT COUNT(*) as t FROM politicians WHERE source='wikipedia'").get()
  const wp2 = db.prepare("SELECT COUNT(*) as t FROM politicians WHERE party_id IS NOT NULL").get()
  console.log(`Total: ${total.t} | Wiki seeded: ${wp.t} | With party: ${wp2.t}`)

  // Scores for new
  const insertScore = db.prepare(`INSERT OR IGNORE INTO score_history 
    (politician_id, score_type, score, confidence, period, source)
    VALUES (?, ?, ?, ?, '2004-2026', 'wikipedia_default')`)
  const np = db.prepare(`SELECT id FROM politicians WHERE source='wikipedia' AND id NOT IN 
    (SELECT politician_id FROM score_history WHERE score_type='composite')`).all()
  for (const p of np) { insertScore.run(p.id, 'composite', 5.0, 0.3); insertScore.run(p.id, 'honesty', 5.0, 0.3) }
  console.log(`Scores: ${np.length} new`)

  db.close()
}

main().catch(e => { console.error(e); process.exit(1) })