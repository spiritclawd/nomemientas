#!/usr/bin/env node
/**
 * Wikipedia seed v2 — Batch fetch for curated politician list
 * 
 * Estrategia:
 * 1. Lista curada de ~220 politicos españoles
 * 2. Fetch batches de 50 desde Wikipedia (parallel con limite de concurrencia)
 * 3. Insertar en DB
 */
const https = require('https')
const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'db', 'nomemientas.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

const WIKI_API = 'https://es.wikipedia.org/w/api.php'

const PARTY_MAP = {
  'PSOE': 'psoe', 'Partido Socialista Obrero Español': 'psoe', 'PSC': 'psoe',
  'PP': 'pp', 'Partido Popular': 'pp',
  'Vox': 'vox',
  'Sumar': 'sumar', 'Movimiento Sumar': 'sumar',
  'Podemos': 'podemos', 'Unidas Podemos': 'podemos',
  'ERC': 'erc', 'Esquerra Republicana de Catalunya': 'erc',
  'Junts': 'junts', 'Junts per Catalunya': 'junts',
  'EH Bildu': 'eh-bildu',
  'PNV': 'pnv', 'Partido Nacionalista Vasco': 'pnv',
  'CC': 'cc', 'Coalición Canaria': 'cc',
  'UPN': 'upn', 'Unión del Pueblo Navarro': 'upn',
  'BNG': 'bng', 'Bloque Nacionalista Galego': 'bng',
  'Cs': 'cs', 'Ciudadanos': 'cs',
  'IU': 'iu', 'Izquierda Unida': 'iu',
  'Compromís': 'sumar',
}

// === CURATED LIST OF 200+ POLITICIANS ===
const POLITICIANS = [
  // -- GOBIERNO ACTUAL (PSOE+Sumar) --
  'Pedro Sánchez', 'María Jesús Montero', 'Margarita Robles', 'Fernando Grande-Marlaska',
  'Félix Bolaños', 'Pilar Alegría', 'Diana Morant', 'Óscar Puente',
  'José Manuel Albares', 'Jordi Hereu', 'Luis Planas', 'Elma Saiz',
  'Ana Redondo', 'Ernest Urtasun', 'Ángel Víctor Torres', 'Mónica García',
  'Yolanda Díaz', 'Pablo Bustinduy', 'Jordi Hereu',
  // -- PSOE --
  'Patxi López', 'Salvador Illa', 'Francina Armengol', 'Santos Cerdán',
  'Adriana Lastra', 'Elena Espinosa', 'José Blanco', 'José Luis Rodríguez Zapatero',
  'Alfredo Pérez Rubalcaba', 'Felipe González', 'Javier Solana',
  'Carmen Calvo', 'Mercedes González', 'Cristina Narbona',
  'Juan Lobato', 'Lambán', 'Emiliano García-Page', 'Adrián Barbón',
  'María Chivite', 'Rafaela Crespín', 'Andrea Fernández',
  // -- PP --
  'Alberto Núñez Feijóo', 'Cuca Gamarra', 'Borja Sémper', 'Esteban González Pons',
  'Pedro Rollán', 'María Guardiola', 'Alfonso Rueda', 'Isabel Díaz Ayuso',
  'José Luis Martínez-Almeida', 'Juanma Moreno', 'Carlos Mazón',
  'Mariano Rajoy', 'José María Aznar', 'Jaime Mayor Oreja',
  'Ana Pastor', 'Soraya Sáenz de Santamaría', 'Rafael Catalá',
  'María Dolores de Cospedal', 'Pablo Casado', 'Enrique López',
  'Alicia Sánchez-Camacho', 'Cayetana Álvarez de Toledo', 'Javier Maroto',
  'Rafael Hernando', 'Teodoro García Egea', 'Andrea Levy',
  'Marta Varela', 'Pilar Marcos', 'Miguel Tellado',
  // -- VOX --
  'Santiago Abascal', 'Jorge Buxadé', 'Ignacio Garriga', 'Rocío de Meer',
  'Javier Ortega Smith', 'Iván Espinosa de los Monteros', 'Macarena Olona',
  'Cristina Esteban', 'Luis de la Iglesia', 'José María Figaredo',
  // -- SUMAR --
  'Marta Lois', 'Íñigo Errejón', 'Verónica Martínez Barbero',
  'Lander Martínez', 'Rosa María Medel', 'Aina Vidal',
  // -- PODEMOS --
  'Pablo Iglesias', 'Ione Belarra', 'Irene Montero', 'Juan Carlos Monedero',
  'Rafael Mayoral', 'Noelia Vera', 'Alberto Rodríguez',
  'Jesús Santos', 'Alejandra Abad', 'María Teresa Pérez',
  // -- ERC --
  'Oriol Junqueras', 'Pere Aragonès', 'Gabriel Rufián', 'Marta Vilalta',
  'Teresa Jordà', 'Raül Romeva', 'Josep Maria Jové',
  'Meritxell Serret', 'María Assumpció Balcells',
  // -- JUNTS --
  'Carles Puigdemont', 'Míriam Nogueras', 'Josep Rull', 'Laura Borràs',
  'Elsa Artadi', 'Jordi Sànchez i Picanyol', 'Anna Erra',
  // -- PNV --
  'Andoni Ortuzar', 'Iñigo Urkullu', 'Imanol Pradales', 'Aitor Esteban',
  'Josu Erkoreka', 'Pedro María Azpiazu',
  // -- EH BILDU --
  'Arnaldo Otegi', 'Mertxe Aizpurua', 'Natxo Urbieta',
  'Oihana Etxebarrieta', 'Pello Urizar', 'Maddalen Iriarte',
  // -- CC --
  'Fernando Clavijo', 'Cristina Valido', 'Ana Oramas',
  'Luis Campos', 'Gustavo Santana',
  // -- BNG --
  'Ana Pontón', 'Néstor Rego', 'Xose Francisco dos Santos',
  // -- UPN --
  'José Javier Esparza', 'Cristina Ibarrola',
  // -- CIUDADANOS --
  'Albert Rivera', 'Inés Arrimadas', 'Juan Carlos Girauta',
  'Luis Garicano', 'Marian Báñez', 'Edmundo Bal',
  // -- IZQUIERDA UNIDA --
  'Antonio Maíllo', 'Gaspar Llamazares', 'Cayo Lara',
  'Alberto Garzón', 'Enrique Santiago', 'Amparo Valcárcel',
  // -- HISTÓRICOS / OTRAS FIGURAS --
  'Carme Chacón', 'José Bono', 'Jesús Caldera', 'Joaquín Almunia',
  'Manuel Chaves', 'Juan Fernando López Aguilar',
  'Jokin Bildarratz', 'Bildu Otegi',
  'Miguel Ángel Revilla', 'Juan Antonio Aracil',
  'Xavier Trias', 'Ada Colau', 'Artur Mas', 'Pasqual Maragall',
  'Josep Borrell', 'Federico Trillo', 'Rodrigo Rato',
  'Francisco Álvarez-Cascos', 'Vidal-Quadras', 'José María Michavila',
  'Eduardo Zaplana', 'Manuela Carmena', 'José Antonio Griñán',
  'Susana Díaz', 'Guillermo Fernández Vara',
  'Ignacio Aguado', 'Francisco Igea', 'Ruth Beitia',
  'Tezanos', 'José María Álvarez del Manzano',
  // -- PERIODISTAS/CARAS PÚBLICAS --
  'Alibert', 'Jorge Javier Vázquez', 'Ana Rosa Quintana',
  // Clean up: remove non-politicians
].filter(n => !['Alibert', 'Jorge Javier Vázquez', 'Ana Rosa Quintana', 'Tezanos'].includes(n))

// === WIKIPEDIA API HELPERS ===
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'nomemientas/1.0' } }, (res) => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch(e) { reject(e) } })
    }).on('error', reject)
  })
}

function makeSlug(name) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// === BATCH FETCH ===
async function batchFetch(allNames) {
  const results = {}

  // 1. Search for exact titles using search API (handles accented names)
  console.log('[1/3] Searching for pages...')
  const searchResults = {}
  for (let i = 0; i < allNames.length; i += 10) {
    const batch = allNames.slice(i, i + 10)
    await Promise.all(batch.map(async (name) => {
      try {
        const params = new URLSearchParams({
          action: 'query', format: 'json', list: 'search',
          srsearch: name, srlimit: '1',
        })
        const data = await fetchJson(WIKI_API + '?' + params)
        const page = data.query?.search?.[0]
        if (page && page.title) searchResults[name] = page.title
      } catch {}
    }))
    if ((i + 10) % 50 === 0) process.stdout.write('.')
  }
  console.log('\n  Found ' + Object.keys(searchResults).length + '/' + allNames.length + ' pages')

  // 2. Batch fetch extracts (50 at a time)
  console.log('[2/3] Fetching extracts...')
  const titles = [...new Set(Object.values(searchResults))]
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
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
        results[p.title] = results[p.title] || {}
        results[p.title].extract = (p.extract || '').slice(0, 1500)
      }
    } catch {}
    if ((i + 50) % 200 === 0) process.stdout.write('.')
  }
  console.log('')

  // 3. Batch fetch structured data (parse API, slower - do limited set)
  console.log('[3/3] Fetching infobox data...')
  const topTitles = titles.slice(0, 200)
  for (let i = 0; i < topTitles.length; i += 5) {
    const batch = topTitles.slice(i, i + 5)
    await Promise.all(batch.map(async (title) => {
      try {
        const params = new URLSearchParams({
          action: 'parse', format: 'json', page: title,
          prop: 'text', section: '0', disablelimitreport: '1',
        })
        const data = await fetchJson(WIKI_API + '?' + params)
        const html = data.parse?.text?.['*'] || ''
        const info = { party: null, positions: [] }

        // Party
        const pm = html.match(/Partido\s+pol[íi]tico[^<]*<[^>]+>([^<]+)</i)
        if (pm) {
          const pn = pm[1].trim()
          for (const [name, slug] of Object.entries(PARTY_MAP)) {
            if (pn.includes(name) || name.includes(pn)) { info.party = slug; break }
          }
        }

        // Positions
        const pr = /<th[^>]*>(?:Cargo|President[ea]|Ministro|Diputado|Senador|Alcalde|Consejero|Vicepresident[ea])[^<]*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi
        let m; while ((m = pr.exec(html)) !== null) {
          const t = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
          if (t && t.length < 150) info.positions.push(t)
        }

        results[title] = results[title] || {}
        results[title].party = info.party
        results[title].positions = info.positions
      } catch {}
    }))
    if ((i + 5) % 25 === 0) process.stdout.write('.')
  }
  console.log('')

  return { results, searchResults }
}

// === MAIN ===
async function main() {
  console.log('=== WIKIPEDIA SEED V2 ===')
  
  const startTime = Date.now()
  const { results, searchResults } = await batchFetch(POLITICIANS)
  console.log('\nFetched data for ' + Object.keys(results).length + ' pages\n')

  // Insert into DB
  console.log('Inserting into database...')
  const insertPol = db.prepare(`INSERT OR IGNORE INTO politicians 
    (slug, full_name, display_name, party_id, biography, current_position, positions, source, source_data)
    VALUES (?, ?, ?, (SELECT id FROM parties WHERE slug = ?), ?, ?, ?, 'wikipedia', ?)`)

  let inserted = 0, skipped = 0
  for (const [name, wikiTitle] of Object.entries(searchResults)) {
    const data = results[wikiTitle]
    if (!data || !data.extract) { skipped++; continue }

    // Detect party from extract if infobox didn't get it
    let party = data.party
    if (!party) {
      const pm = data.extract.match(/(?:del|del partido|de) ([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s]{2,50})?([A-ZÁÉÍÓÚÑ]{2,10})/i)
      if (pm) {
        const cand = pm[1] || pm[2] || ''
        for (const [pname, slug] of Object.entries(PARTY_MAP)) {
          if (cand.includes(pname) || pname.includes(cand)) { party = slug; break }
        }
      }
    }

    const slug = makeSlug(name)
    const bio = data.extract.slice(0, 2000)
    
    try {
      insertPol.run(slug, wikiTitle, name, party || null, bio, (data.positions?.[0] || ''), JSON.stringify(data.positions || []), JSON.stringify({wiki: wikiTitle}))
      inserted++
    } catch { skipped++ }
  }

  console.log(`\n=== RESULTS ===`)
  console.log(`  Inserted: ${inserted}`)
  console.log(`  Skipped: ${skipped}`)
  const total = db.prepare('SELECT COUNT(*) as total FROM politicians').get()
  console.log(`  Total politicians in DB: ${total.total}`)
  console.log(`  Time: ${Math.round((Date.now() - startTime) / 1000)}s`)

  // Default scores for new politicians
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
  console.log(`  Scores for ${newPols.length} new politicians`)

  db.close()
  console.log('\nDone!')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })