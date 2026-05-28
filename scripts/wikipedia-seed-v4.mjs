#!/usr/bin/env node
/**
 * Wikipedia seed v4 — Direct page_fetch by known titles, batch 50
 * 
 * Enfoque: mapeo manual de nombres a títulos Wikipedia, fetch en batches de 50.
 * Sin búsqueda (search/opensearch) — solo consulta directa.
 */
import https from 'https'
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'db', 'nomemientas.db')
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
  [/CC|Coalici.n Canaria/i, 'cc'],
  [/UPN|Uni.n del Pueblo Navarro/i, 'upn'],
  [/BNG|Bloque Nacionalista Galego/i, 'bng'],
  [/Cs|Ciudadanos/i, 'cs'],
  [/IU|Izquierda Unida/i, 'iu'],
]

// Mapeo manual: "nombre legible" -> "Título correcto en Wikipedia"
const POLITICIANS = {
  'Pedro Sánchez': 'Pedro Sánchez',
  'María Jesús Montero': 'María Jesús Montero',
  'Margarita Robles': 'Margarita Robles',
  'Fernando Grande-Marlaska': 'Fernando Grande-Marlaska',
  'Félix Bolaños': 'Félix Bolaños',
  'Pilar Alegría': 'Pilar Alegría',
  'Diana Morant': 'Diana Morant',
  'Óscar Puente': 'Óscar Puente',
  'José Manuel Albares': 'José Manuel Albares',
  'Jordi Hereu': 'Jordi Hereu',
  'Luis Planas': 'Luis Planas',
  'Elma Saiz': 'Elma Saiz',
  'Ana Redondo': 'Ana Redondo',
  'Ernest Urtasun': 'Ernest Urtasun',
  'Ángel Víctor Torres': 'Ángel Víctor Torres',
  'Mónica García': 'Mónica García (política)',
  'Yolanda Díaz': 'Yolanda Díaz',
  'Pablo Bustinduy': 'Pablo Bustinduy',
  'Patxi López': 'Patxi López',
  'Salvador Illa': 'Salvador Illa',
  'Francina Armengol': 'Francina Armengol',
  'Santos Cerdán': 'Santos Cerdán',
  'Adriana Lastra': 'Adriana Lastra',
  'José Luis Rodríguez Zapatero': 'José Luis Rodríguez Zapatero',
  'Alfredo Pérez Rubalcaba': 'Alfredo Pérez Rubalcaba',
  'Felipe González': 'Felipe González',
  'Carmen Calvo': 'Carmen Calvo',
  'Cristina Narbona': 'Cristina Narbona',
  'Juan Lobato': 'Juan Lobato',
  'Javier Lambán': 'Javier Lambán',
  'Emiliano García-Page': 'Emiliano García-Page',
  'Adrián Barbón': 'Adrián Barbón',
  'María Chivite': 'María Chivite',
  'Andrea Fernández': 'Andrea Fernández',
  'Alberto Núñez Feijóo': 'Alberto Núñez Feijóo',
  'Cuca Gamarra': 'Cuca Gamarra',
  'Borja Sémper': 'Borja Sémper',
  'Esteban González Pons': 'Esteban González Pons',
  'Pedro Rollán': 'Pedro Rollán',
  'María Guardiola': 'María Guardiola',
  'Alfonso Rueda': 'Alfonso Rueda',
  'Isabel Díaz Ayuso': 'Isabel Díaz Ayuso',
  'José Luis Martínez-Almeida': 'José Luis Martínez-Almeida',
  'Juanma Moreno': 'Juanma Moreno',
  'Carlos Mazón': 'Carlos Mazón',
  'Mariano Rajoy': 'Mariano Rajoy',
  'José María Aznar': 'José María Aznar',
  'Ana Pastor': 'Ana Pastor (política)',
  'Soraya Sáenz de Santamaría': 'Soraya Sáenz de Santamaría',
  'María Dolores de Cospedal': 'María Dolores de Cospedal',
  'Pablo Casado': 'Pablo Casado',
  'Cayetana Álvarez de Toledo': 'Cayetana Álvarez de Toledo',
  'Javier Maroto': 'Javier Maroto',
  'Rafael Hernando': 'Rafael Hernando (político)',
  'Teodoro García Egea': 'Teodoro García Egea',
  'Miguel Tellado': 'Miguel Tellado',
  'Santiago Abascal': 'Santiago Abascal',
  'Jorge Buxadé': 'Jorge Buxadé',
  'Ignacio Garriga': 'Ignacio Garriga',
  'Rocío de Meer': 'Rocío de Meer',
  'Javier Ortega Smith': 'Javier Ortega Smith',
  'Iván Espinosa de los Monteros': 'Iván Espinosa de los Monteros',
  'Macarena Olona': 'Macarena Olona',
  'Marta Lois': 'Marta Lois',
  'Íñigo Errejón': 'Íñigo Errejón',
  'Ione Belarra': 'Ione Belarra',
  'Irene Montero': 'Irene Montero',
  'Juan Carlos Monedero': 'Juan Carlos Monedero',
  'Oriol Junqueras': 'Oriol Junqueras',
  'Pere Aragonès': 'Pere Aragonès',
  'Gabriel Rufián': 'Gabriel Rufián',
  'Carles Puigdemont': 'Carles Puigdemont',
  'Míriam Nogueras': 'Míriam Nogueras',
  'Josep Rull': 'Josep Rull',
  'Laura Borràs': 'Laura Borràs',
  'Andoni Ortuzar': 'Andoni Ortuzar',
  'Iñigo Urkullu': 'Iñigo Urkullu',
  'Imanol Pradales': 'Imanol Pradales',
  'Aitor Esteban': 'Aitor Esteban',
  'Josu Erkoreka': 'Josu Erkoreka',
  'Arnaldo Otegi': 'Arnaldo Otegi',
  'Mertxe Aizpurua': 'Mertxe Aizpurua',
  'Fernando Clavijo': 'Fernando Clavijo Batlle',
  'Ana Oramas': 'Ana Oramas',
  'Ana Pontón': 'Ana Pontón',
  'Néstor Rego': 'Néstor Rego',
  'Albert Rivera': 'Albert Rivera',
  'Inés Arrimadas': 'Inés Arrimadas',
  'Alberto Garzón': 'Alberto Garzón',
  'Gaspar Llamazares': 'Gaspar Llamazares',
  'Cayo Lara': 'Cayo Lara',
  'Enrique Santiago': 'Enrique Santiago',
  'Manuel Chaves': 'Manuel Chaves',
  'José Bono': 'José Bono',
  'Miguel Ángel Revilla': 'Miguel Ángel Revilla',
  'Ada Colau': 'Ada Colau',
  'Artur Mas': 'Artur Mas',
  'Pasqual Maragall': 'Pasqual Maragall',
  'Xavier Trias': 'Xavier Trias',
  'Josep Borrell': 'Josep Borrell',
  'Manuela Carmena': 'Manuela Carmena',
  'Susana Díaz': 'Susana Díaz',
  'Guillermo Fernández Vara': 'Guillermo Fernández Vara',
  'Ignacio Aguado': 'Ignacio Aguado',
  'Esperanza Aguirre': 'Esperanza Aguirre',
  'Cristina Cifuentes': 'Cristina Cifuentes',
  'Alberto Ruiz-Gallardón': 'Alberto Ruiz-Gallardón',
  'Ángel Gabilondo': 'Ángel Gabilondo',
  'Eduardo Madina': 'Eduardo Madina',
  'Antonio Maíllo': 'Antonio Maíllo',
  'Tomás Gómez': 'Tomás Gómez (político)',
  'José Antonio Griñán': 'José Antonio Griñán',
  'Joan Baldoví': 'Joan Baldoví',
  'Luis Garicano': 'Luis Garicano',
  'Edmundo Bal': 'Edmundo Bal',
  'Rodrigo Rato': 'Rodrigo Rato',
  'Alicia Sánchez-Camacho': 'Alicia Sánchez-Camacho',
  'Joaquín Almunia': 'Joaquín Almunia',
  'Elena Espinosa': 'Elena Espinosa',
  'José Blanco': 'José Blanco (político)',
  'Jesús Caldera': 'Jesús Caldera',
  'Raül Romeva': 'Raül Romeva',
  'Marta Vilalta': 'Marta Vilalta',
  'Teresa Jordà': 'Teresa Jordà',
  'Albert Rivera': 'Albert Rivera',
  'Francisco Igea': 'Francisco Igea',
  'Elsa Artadi': 'Elsa Artadi',
  'Meritxell Serret': 'Meritxell Serret',
  'Ángel Garrido': 'Ángel Garrido',
  'Enrique López': 'Enrique López',
  'José María Michavila': 'José María Michavila',
  'Eduardo Zaplana': 'Eduardo Zaplana',
  'Juan Carlos Girauta': 'Juan Carlos Girauta',
  'Ruth Beitia': 'Ruth Beitia',
}

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

function detectParty(text) {
  for (const [pattern, slug] of PARTY_MAP) {
    if (pattern.test(text)) return slug
  }
  return null
}

async function main() {
  console.log('=== WIKIPEDIA SEED V4 ===\n')
  const start = Date.now()
  const entries = Object.entries(POLITICIANS)

  // Batch fetch extracts (50 at a time - single API call per batch!)
  console.log('[1/2] Batch fetching extracts (' + entries.length + ' pages)...')
  const results = {}

  for (let i = 0; i < entries.length; i += 20) {
    const batch = entries.slice(i, i + 20)
    const titles = batch.map(([_, t]) => t).join('|')

    try {
      const params = new URLSearchParams({
        action: 'query', format: 'json', prop: 'extracts',
        exintro: '1', explaintext: '1', exlimit: '20',
        titles: titles,
      })
      const data = await fetchJson(WIKI_API + '?' + params)
      const pages = data.query?.pages || {}
      for (const id of Object.keys(pages)) {
        if (id === '-1') continue
        const p = pages[id]
        results[p.title] = (p.extract || '').slice(0, 1500)
      }
    } catch (e) {
      console.log('  Batch error:', e.message)
    }
    process.stdout.write('.')
    await sleep(800) // Rate limit
  }
  console.log('\n  Got ' + Object.keys(results).length + ' extracts\n')

  // Insert into DB
  console.log('[2/2] Inserting into DB...')
  const insertPol = db.prepare(`INSERT OR IGNORE INTO politicians 
    (slug, full_name, display_name, party_id, biography, source)
    VALUES (?, ?, ?, (SELECT id FROM parties WHERE slug = ?), ?, 'wikipedia')`)

  let inserted = 0, skipped = 0
  for (const [name, wikiTitle] of entries) {
    const extract = results[wikiTitle]
    if (!extract || extract.length < 20) { skipped++; continue }

    const party = detectParty(extract)
    const slug = makeSlug(name)
    const bio = extract.slice(0, 1500)

    try {
      insertPol.run(slug, wikiTitle, name, party, bio)
      inserted++
    } catch (e) {
      skipped++
      if (inserted === 0) console.log('  First insert error:', e.message)
    }
  }

  const total = db.prepare('SELECT COUNT(*) as total FROM politicians').get()
  const wikiCount = db.prepare("SELECT COUNT(*) as total FROM politicians WHERE source='wikipedia'").get()

  console.log(`\n=== RESULTS ===`)
  console.log(`  Inserted (new): ${inserted}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Total seeded: ${wikiCount.total}`)
  console.log(`  Total all politicians: ${total.total}`)
  console.log(`  Time: ${Math.round((Date.now() - start) / 1000)}s`)

  // Scores for new politicians
  console.log('\nScores...')
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

main().catch(e => { console.error('FATAL:', e); process.exit(1) })