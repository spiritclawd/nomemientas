#!/usr/bin/env node
// Wikipedia seed R4 - add more politicians using batch fetch
// Uses direct title-based query (no search API needed)
import https from 'https'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'db', 'nomemientas.db')
const CACHE_PATH = path.join(__dirname, '..', '.wiki-cache.json')

const db = new Database(DB_PATH)
const WIKI = 'https://es.wikipedia.org/w/api.php'

const PARTY_RULES = [
  [/PSOE|Partido Socialista|socialista obrero/i, 'psoe'],
  [/Partido Popular|\bPP\b(?!\s+de\s+PSC|\.\s+)/i, 'pp'],
  [/Vox|VOX/i, 'vox'],
  [/Sumar|Movimiento Sumar/i, 'sumar'],
  [/Podemos|Unidas Podemos/i, 'podemos'],
  [/ERC|Esquerra Republicana/i, 'erc'],
  [/Junts|Junts per Catalunya|JxCat|PDeCAT/i, 'junts'],
  [/EH Bildu|Euskal Herria Bildu/i, 'eh-bildu'],
  [/PNV|Partido Nacionalista Vasco|EAJ-PNV/i, 'pnv'],
  [/Coalici.n Canaria|CC a\b/i, 'cc'],
  [/Uni.n del Pueblo Navarro/i, 'upn'],
  [/BNG|Bloque Nacionalista Galego/i, 'bng'],
  [/Ciudadanos|Ciutadans/i, 'cs'],
  [/IU|Izquierda Unida/i, 'iu'],
]

// Manual party overrides for known politicians
const MANUAL = {
  'cristobal-montoro': 'pp', 'jose-ignacio-echaniz': 'pp', 'enrique-lopez': 'pp',
  'eugenio-nasarre': 'pp', 'francisco-contreras': 'pp', 'elviro-aranda': 'psoe',
  'elena-espinosa': 'psoe', 'hector-gomez': 'psoe', 'eduardo-fernandez': 'psoe',
  'alberto-montero': 'podemos', 'antoni-comin': 'junts', 'elsa-artadi': 'junts',
  'artur-mas': 'junts', 'ignacio-aguado': 'cs', 'edmundo-bal': 'cs',
  'simone-veil': null,
}

// Known Wikipedia titles to add (title → display name)
const ADDITIONAL = {
  'Adolfo Suárez': 'Adolfo Suárez',
  'Leopoldo Calvo-Sotelo': 'Leopoldo Calvo-Sotelo',
  'Manuel Azaña': 'Manuel Azaña',
  'Santiago Carrillo': 'Santiago Carrillo',
  'Alfonso Guerra': 'Alfonso Guerra',
  'Julio Anguita': 'Julio Anguita',
  'Francisco Frutos': 'Francisco Frutos',
  'Nicolás Sartorius': 'Nicolás Sartorius',
  'Íñigo Urkullu': 'Íñigo Urkullu',
  'Pello Urizar': 'Pello Urizar',
  'Maddalen Iriarte': 'Maddalen Iriarte',
  'Juan Carlos Rodríguez Ibarra': 'Juan Carlos Rodríguez Ibarra',
  'José María Benegas': 'José María Benegas',
  'Ramón Rubial': 'Ramón Rubial',
  'Emilio Pérez Touriño': 'Emilio Pérez Touriño',
  'Bernat Soria': 'Bernat Soria',
  'Jordi Sevilla': 'Jordi Sevilla',
  'Gregorio Peces-Barba': 'Gregorio Peces-Barba',
  'Carlos Solchaga': 'Carlos Solchaga',
  'Miguel Boyer': 'Miguel Boyer',
  'Antoni Castells': 'Antoni Castells',
  'Isabel Tocino': 'Isabel Tocino',
  'Javier Solana': 'Javier Solana',
  'Francisco Camps': 'Francisco Camps',
  'Carlos Aragonés': 'Carlos Aragonés (político)',
  'Ángel Acebes': 'Ángel Acebes',
  'José Manuel García-Margallo': 'José Manuel García-Margallo',
  'Federico Trillo': 'Federico Trillo',
  'César Antonio Molina': 'César Antonio Molina',
  'Juan José Lucas': 'Juan José Lucas',
  'Javier Rupérez': 'Javier Rupérez',
  'José Valverde': 'José Valverde (político)',
  'Jorge Fernández Díaz': 'Jorge Fernández Díaz',
  'José Antonio Bermúdez de Castro': 'José Antonio Bermúdez de Castro',
  'Juan Manuel Moreno': 'Juan Manuel Moreno',
  'María Dolores de Cospedal': 'María Dolores de Cospedal',
  'Jorge Azcón': 'Jorge Azcón',
  'Fernando López Miras': 'Fernando López Miras',
  'Juan Manuel Moreno Bonilla': 'Juan Manuel Moreno Bonilla',
  'Rafael Simancas': 'Rafael Simancas',
  'Tomás Gómez Franco': 'Tomás Gómez Franco',
  'Odón Elorza': 'Odón Elorza',
  'Jesús Quijano': 'Jesús Quijano',
  'María Antonia Martínez': 'María Antonia Martínez',
  'Jordi Pujol': 'Jordi Pujol',
  'Josep-Lluís Carod-Rovira': 'Josep-Lluís Carod-Rovira',
  'Joan Tardà': 'Joan Tardà',
  'Carles Mundó': 'Carles Mundó',
  'Roger Torrent': 'Roger Torrent',
  'Carme Forcadell': 'Carme Forcadell',
  'Anna Gabriel': 'Anna Gabriel',
  'Iñaki Anasagasti': 'Iñaki Anasagasti',
  'Jon Jauregi': 'Jon Jauregi',
  'Iago Negueruela': 'Iago Negueruela',
  'Gonzalo Jácome': 'Gonzalo Jácome',
  'Juan Velarde Fuertes': 'Juan Velarde Fuertes',
  'José María Álvarez del Manzano': 'José María Álvarez del Manzano',
  'Rafael Arias-Salgado': 'Rafael Arias-Salgado',
  'Pío García-Escudero': 'Pío García-Escudero',
  'María Antonia Trujillo': 'María Antonia Trujillo',
  'Cristina Alberdi': 'Cristina Alberdi',
  'Elena Salgado': 'Elena Salgado',
  'Fernando González Laxe': 'Fernando González Laxe',
  'Pere Esteve': 'Pere Esteve (político)',
  'Francesc Homs': 'Francesc Homs i Molist',
  'Vidal de Nicolás': 'Vidal de Nicolás',
  'Ángel Colom': 'Ángel Colom',
  'Hilari Salvadó': 'Hilari Salvadó',
  'José Cruz Pérez': 'José Cruz Pérez',
  'Matías Alonso': 'Matías Alonso',
  'Manuel Mariscal': 'Manuel Mariscal de Gante',
  'Carmen Lobo': 'Carmen Lobo',
  'Eloísa Álvarez': 'Eloísa Álvarez',
  'Rosa María Romero': 'Rosa María Romero (política)',
  'María Ángeles García': 'María Ángeles García (política)',
  'María Jesús Serrano': 'María Jesús Serrano Jiménez',
  'María José Pacheco': 'María José Pacheco (política)',
  'María Luz Martínez': 'María Luz Martínez Seijo',
  'Julián López Milla': 'Julián López Milla',
  'Pedro Saura': 'Pedro Saura García',
  'Alejandro Soler': 'Alejandro Soler (político)',
  'José Manuel Franco Pardo': 'José Manuel Franco Pardo',
  'José Luis Ábalos': 'José Luis Ábalos',
  'Héctor Gómez Hernández': 'Héctor Gómez Hernández',
  'Raquel Sánchez Jiménez': 'Raquel Sánchez Jiménez',
  'María Reyes Maroto': 'María Reyes Maroto',
  'Luis Tudanca': 'Luis Tudanca',
  'Pablo Zuloaga': 'Pablo Zuloaga',
  'Guillermo Fernández Vara': 'Guillermo Fernández Vara',
  'Susana Díaz Pacheco': 'Susana Díaz Pacheco',
  'Manuel Chaves González': 'Manuel Chaves González',
  'José Antonio Griñán': 'José Antonio Griñán',
  'Gaspar Zarrías': 'Gaspar Zarrías',
  'María Teresa Fernández de la Vega': 'María Teresa Fernández de la Vega',
  'Leire Pajín': 'Leire Pajín',
  'Valeriano Gómez': 'Valeriano Gómez',
  'Cristina Garmendia': 'Cristina Garmendia',
  'Miguel Sebastián': 'Miguel Sebastián',
  'Trinidad Jiménez': 'Trinidad Jiménez',
  'Juan Fernando López Aguilar': 'Juan Fernando López Aguilar',
  'Felipe González': 'Felipe González',
  'Mariano Rajoy': 'Mariano Rajoy Brey',
  'José María Aznar': 'José María Aznar',
  'Fernando Fernández de Mesa': 'Fernando Fernández de Mesa',
  'Rita Barberá': 'Rita Barberá',
  'Celso Villalibre': 'Celso Villalibre',
  'Luis de la Vega': 'Luis de la Vega',
}

function fetch(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'nomemientas/1.0' } }, r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(e)}})
    }).on('error',rej)
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function makeSlug(name) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
}

async function main() {
  console.log('=== WIKIPEDIA SEED R4 ===')
  const start = Date.now()
  const existing = new Set(db.prepare('SELECT slug FROM politicians').all().map(r => r.slug))
  
  const entries = Object.entries(ADDITIONAL).filter(([_, t]) => {
    const slug = makeSlug(t.split('(')[0].trim())
    return !existing.has(slug)
  })
  console.log(`New to fetch: ${entries.length} / ${Object.keys(ADDITIONAL).length}`)

  if (entries.length === 0) { console.log('Nothing new.'); db.close(); return }

  // Batch fetch extracts
  const fetched = {}
 for (let i = 0; i < entries.length; i += 20) {
      const batch = entries.slice(i, i + 20).map(([_, t]) => t)
    try {
      const params = new URLSearchParams({
        action: 'query', format: 'json', prop: 'extracts',
        exintro: '1', explaintext: '1', exlimit: '20',
        titles: batch.join('|'),
      })
      const data = await fetch(WIKI + '?' + params)
      for (const [id, p] of Object.entries(data.query?.pages || {})) {
        if (id !== '-1') fetched[p.title] = (p.extract || '').slice(0, 1500)
      }
    } catch (e) { console.log('  Batch error:', e.message) }
    process.stdout.write('.')
    await sleep(600)
  }
  console.log('\nFetched: ' + Object.keys(fetched).length)

  // Insert
  const ins = db.prepare(`INSERT OR IGNORE INTO politicians 
    (slug, full_name, display_name, party_id, biography, source)
    VALUES (?, ?, ?, (SELECT id FROM parties WHERE slug = ?), ?, 'wikipedia')`)
  const insScore = db.prepare('INSERT OR IGNORE INTO score_history (politician_id, score_type, score, confidence, period, source) VALUES (?, ?, ?, ?, ?, ?)')

  let inserted = 0
  for (const [name, wikiTitle] of entries) {
    const ext = fetched[wikiTitle]
    if (!ext || ext.length < 5) continue

    // Detect party
    let slug = MANUAL[makeSlug(name)] || null
    if (!slug) {
      const fs = ext.split('.')[0] || ext
      for (const [re, s] of PARTY_RULES) {
        if (re.test(fs)) { slug = s; break }
      }
    }

    const s = makeSlug(name)
    try {
      ins.run(s, wikiTitle, name, slug, ext.slice(0, 1500))
      // Add score for new
      const polId = db.prepare('SELECT id FROM politicians WHERE slug = ?').get(s)
      if (polId) {
        insScore.run(polId.id, 'composite', 5.0, 0.3, '2004-2026', 'wikipedia_default')
        insScore.run(polId.id, 'honesty', 5.0, 0.3, '2004-2026', 'wikipedia_default')
      }
      inserted++
    } catch {}
  }

  const total = db.prepare('SELECT COUNT(*) as t FROM politicians').get().t
  const withP = db.prepare('SELECT COUNT(*) as t FROM politicians WHERE party_id IS NOT NULL').get().t
  console.log(`Inserted: ${inserted} | Total: ${total} | With party: ${withP}`)
  console.log('Time: ' + Math.round((Date.now()-start)/1000) + 's')
  db.close()
}

main().catch(e => { console.error(e); process.exit(1) })