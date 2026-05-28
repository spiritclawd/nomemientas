#!/usr/bin/env node
/**
 * Wikipedia seed v3 — OpenSearch + batch fetch, robust party detection
 */
import https from 'https'
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'db', 'nomemientas.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

const WIKI_API = 'https://es.wikipedia.org/w/api.php'

const PARTY_MAP = [
  [/PSOE|PSC|Partido Socialista/i, 'psoe'],
  [/Partido Popular|PP$/i, 'pp'],
  [/Vox|VOX/i, 'vox'],
  [/Sumar|Movimiento Sumar/i, 'sumar'],
  [/Podemos|Unidas Podemos/i, 'podemos'],
  [/ERC|Esquerra/i, 'erc'],
  [/Junts|Junts per Catalunya|JxCat/i, 'junts'],
  [/EH Bildu|Euskal Herria Bildu/i, 'eh-bildu'],
  [/PNV|Partido Nacionalista Vasco|EAJ-PNV/i, 'pnv'],
  [/CC|Coalici.n Canaria/i, 'cc'],
  [/UPN|Uni.n del Pueblo Navarro/i, 'upn'],
  [/BNG|Bloque Nacionalista Galego/i, 'bng'],
  [/Cs|Ciudadanos|Ciutadans/i, 'cs'],
  [/IU|Izquierda Unida/i, 'iu'],
  [/Comprom.s|M.s Comprom.s/i, 'sumar'],
]

// Lista de 174 politicians
const POLITICIANS = [
  'Pedro Sánchez', 'María Jesús Montero', 'Margarita Robles', 'Fernando Grande-Marlaska',
  'Félix Bolaños', 'Pilar Alegría', 'Diana Morant', 'Óscar Puente',
  'José Manuel Albares', 'Jordi Hereu', 'Luis Planas', 'Elma Saiz',
  'Ana Redondo', 'Ernest Urtasun', 'Ángel Víctor Torres', 'Mónica García',
  'Yolanda Díaz', 'Pablo Bustinduy',
  'Patxi López', 'Salvador Illa', 'Francina Armengol', 'Santos Cerdán',
  'Adriana Lastra', 'José Luis Rodríguez Zapatero',
  'Alfredo Pérez Rubalcaba', 'Felipe González',
  'Carmen Calvo', 'Cristina Narbona', 'Juan Lobato',
  'Javier Lambán', 'Emiliano García-Page', 'Adrián Barbón',
  'María Chivite', 'Andrea Fernández',
  'Alberto Núñez Feijóo', 'Cuca Gamarra', 'Borja Sémper', 'Esteban González Pons',
  'Pedro Rollán', 'María Guardiola', 'Alfonso Rueda', 'Isabel Díaz Ayuso',
  'José Luis Martínez-Almeida', 'Juanma Moreno', 'Carlos Mazón',
  'Mariano Rajoy', 'José María Aznar',
  'Ana Pastor', 'Soraya Sáenz de Santamaría',
  'María Dolores de Cospedal', 'Pablo Casado',
  'Cayetana Álvarez de Toledo', 'Javier Maroto',
  'Rafael Hernando', 'Teodoro García Egea',
  'Miguel Tellado',
  'Santiago Abascal', 'Jorge Buxadé', 'Ignacio Garriga', 'Rocío de Meer',
  'Javier Ortega Smith', 'Iván Espinosa de los Monteros', 'Macarena Olona',
  'Marta Lois', 'Íñigo Errejón', 'Verónica Martínez Barbero',
  'Ione Belarra', 'Irene Montero', 'Juan Carlos Monedero',
  'Alberto Rodríguez',
  'Oriol Junqueras', 'Pere Aragonès', 'Gabriel Rufián', 'Marta Vilalta',
  'Teresa Jordà', 'Raül Romeva', 'Josep Maria Jové',
  'Meritxell Serret',
  'Carles Puigdemont', 'Míriam Nogueras', 'Josep Rull', 'Laura Borràs',
  'Elsa Artadi',
  'Andoni Ortuzar', 'Iñigo Urkullu', 'Imanol Pradales', 'Aitor Esteban',
  'Josu Erkoreka',
  'Arnaldo Otegi', 'Mertxe Aizpurua',
  'Maddalen Iriarte',
  'Fernando Clavijo Batlle', 'Cristina Valido', 'Ana Oramas',
  'Ana Pontón', 'Néstor Rego',
  'José Javier Esparza',
  'Albert Rivera', 'Inés Arrimadas', 'Juan Carlos Girauta',
  'Edmundo Bal',
  'Alberto Garzón', 'Antonio Maíllo', 'Gaspar Llamazares', 'Cayo Lara',
  'Enrique Santiago',
  'Manuel Chaves', 'José Bono', 'Joaquín Almunia',
  'Miguel Ángel Revilla',
  'Ada Colau', 'Artur Mas', 'Pasqual Maragall', 'Xavier Trias',
  'Josep Borrell',
  'Manuela Carmena', 'Susana Díaz', 'Guillermo Fernández Vara',
  'Ignacio Aguado', 'Francisco Igea',
  'Alberto Rodríguez', // Canarian politician
  'Ángel Gabilondo', 'Tomás Gómez', 'Rafael Simancas',
  'Eduardo Madina', 'Odón Elorza', 'Jordi Hereu',
  'José Antonio Griñán', 'Susana Díaz',
  'Juan Velarde', 'José María Álvarez del Manzano',
  'Alberto Ruiz-Gallardón', 'Esperanza Aguirre', 'Cristina Cifuentes',
  'Ángel Garrido', 'Pedro Ruiz', 'Paloma Adrados',
  'María Cristina de Borbón', // just in case
].filter(n => !n.includes('Cristina de'))

// === HELPERS ===
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

// === MAIN ===
async function main() {
  console.log('=== WIKIPEDIA SEED V3 ===\n')
  const start = Date.now()

  // Step 1: OpenSearch for each name (fuzzy, handles accents)
  console.log('[1/3] OpenSearch for page titles...')
  const pageTitles = new Map()
  for (const name of POLITICIANS) {
    try {
      const params = new URLSearchParams({
        action: 'opensearch', format: 'json', search: name, limit: '1', namespace: '0',
      })
      const data = await fetchJson(WIKI_API + '?' + params)
      const titles = data[1] || []
      if (titles.length > 0 && titles[0].length < 60) {
        pageTitles.set(titles[0], name)
      }
    } catch {}
    await sleep(100)
    if (pageTitles.size % 25 === 0) process.stdout.write('.')
  }
  console.log('\n  Found ' + pageTitles.size + ' / ' + POLITICIANS.length + ' pages\n')

  // Step 2: Batch fetch extracts (50 at a time)
  console.log('[2/3] Batch fetch extracts...')
  const extracts = {}
  const allTitles = [...pageTitles.keys()]
  for (let i = 0; i < allTitles.length; i += 50) {
    const batch = allTitles.slice(i, i + 50)
    try {
      const params = new URLSearchParams({
        action: 'query', format: 'json', prop: 'extracts',
        exintro: '1', explaintext: '1', exlimit: 'max',
        titles: batch.join('|'),
      })
      const data = await fetchJson(WIKI_API + '?' + params)
      const pages = data.query?.pages || {}
      for (const id of Object.keys(pages)) {
        if (id === '-1') continue
        const p = pages[id]
        extracts[p.title] = (p.extract || '').slice(0, 1500)
      }
    } catch {}
    await sleep(500)
    process.stdout.write('.')
  }
  console.log('\n  Got ' + Object.keys(extracts).length + ' extracts\n')

  // Step 3: Insert into DB
  console.log('[3/3] Inserting into DB...')
  const insertPol = db.prepare(`INSERT OR IGNORE INTO politicians 
    (slug, full_name, display_name, party_id, biography, source)
    VALUES (?, ?, ?, (SELECT id FROM parties WHERE slug = ?), ?, 'wikipedia')`)

  let inserted = 0, skipped = 0
  for (const [title, origName] of pageTitles) {
    const extract = extracts[title]
    if (!extract || extract.length < 20) { skipped++; continue }

    // Detect party from extract
    const party = detectParty(extract)
    const slug = makeSlug(origName)
    const bio = extract.slice(0, 1500)

    try {
      insertPol.run(slug, title, origName, party, bio)
      inserted++
    } catch (e) { 
      skipped++
    }
  }

  // Count results
  const total = db.prepare('SELECT COUNT(*) as total FROM politicians').get()
  const wikiCount = db.prepare("SELECT COUNT(*) as total FROM politicians WHERE source='wikipedia'").get()
  
  console.log(`\n=== RESULTS ===`)
  console.log(`  Inserted (new): ${inserted}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Total seeded: ${wikiCount.total}`)
  console.log(`  Total all politicians: ${total.total}`)
  console.log(`  Time: ${Math.round((Date.now() - start) / 1000)}s`)

  // Default scores
  console.log('\nGenerating default scores...')
  const insertScore = db.prepare(`INSERT OR IGNORE INTO score_history 
    (politician_id, score_type, score, confidence, period, source)
    VALUES (?, ?, ?, ?, '2004-2026', 'wikipedia_default')`)
  const newPols = db.prepare(`SELECT id FROM politicians WHERE source = 'wikipedia' 
    AND id NOT IN (SELECT politician_id FROM score_history WHERE score_type = 'composite')`).all()
  for (const p of newPols) {
    insertScore.run(p.id, 'composite', 5.0, 0.3)
    insertScore.run(p.id, 'honesty', 5.0, 0.3)
  }
  console.log(`  Scores: ${newPols.length} new`)

  db.close()
  console.log('\nDone!')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })