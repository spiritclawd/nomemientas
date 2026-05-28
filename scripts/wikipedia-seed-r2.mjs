#!/usr/bin/env node
// V4 Ronda 2 — Más políticos, filtro mínimo
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
  [/Comprom.s|M.s Comprom.s/i, 'sumar'],
]

const ADDITIONAL = {
  'Mercedes Benz': 'Mercedes Benz', 'José Zaragoza': 'José Zaragoza', 'Alicia García': 'Alicia García',
  'María José Català': 'María José Català', 'Elisenda Alamany': 'Elisenda Alamany',
  'Pablo Echenique': 'Pablo Echenique', 'Txema Guijarro': 'Txema Guijarro',
  'Jaume Asens': 'Jaume Asens', 'Jorge Moruno': 'Jorge Moruno',
  'Glòria Elizo': 'Glòria Elizo', 'Sofía Castañón': 'Sofía Castañón',
  'Martín González del Valle': 'Martín González del Valle',
  'Javier Sánchez Serna': 'Javier Sánchez Serna', 'María Marín': 'María Marín',
  'Manuel Lago': 'Manuel Lago', 'Pablo Cambronero': 'Pablo Cambronero',
  'Eduardo Fernández': 'Eduardo Fernández', 'Antonio Gutiérrez Limones': 'Antonio Gutiérrez Limones',
  'María Dolores Narváez': 'María Dolores Narváez', 'Isaura Leal': 'Isaura Leal',
  'Emilio del Río': 'Emilio del Río', 'Francisco Contreras': 'Francisco Contreras',
  'María Teresa de Lara': 'María Teresa de Lara', 'Elviro Aranda': 'Elviro Aranda',
  'José Ignacio Echániz': 'José Ignacio Echániz', 'María de los Ángeles Navalón': 'María de los Ángeles Navalón',
  'Pedro Antonio Martín': 'Pedro Antonio Martín', 'Pablo González': 'Pablo González',
  'José Ramón Bauzá': 'José Ramón Bauzá', 'Juan Antonio Pastor': 'Juan Antonio Pastor',
  'Miquel Iceta': 'Miquel Iceta', 'Raquel Sánchez': 'Raquel Sánchez',
  'Miquel Iceta': 'Miquel Iceta', 'Héctor Gómez': 'Héctor Gómez',
  'Isabel Rodríguez': 'Isabel Rodríguez (política)', 'Joan Mesquida': 'Joan Mesquida',
  'María Consuelo Rumi': 'María Consuelo Rumi', 'Alejandro Soler': 'Alejandro Soler (político)',
  'Juan Antonio Marín': 'Juan Antonio Marín', 'José Miguel Bravo': 'José Miguel Bravo',
  'Francesc Ricomà': 'Francesc Ricomà', 'Eva Granados': 'Eva Granados',
  'Montserrat Bassa': 'Montserrat Bassa', 'Núria Marín': 'Núria Marín',
  'Albert Batet': 'Albert Batet', 'Alícia Romero': 'Alícia Romero',
  'David Pérez': 'David Pérez (político)', 'Rosa María Romero': 'Rosa María Romero',
  'María Ángeles García': 'María Ángeles García', 'María Jesús Serrano': 'María Jesús Serrano',
  'José Luis Ábalos': 'José Luis Ábalos', 'María José Pacheco': 'María José Pacheco (política)',
  'Macarena Montesinos': 'Macarena Montesinos', 'Pablo Zuloaga': 'Pablo Zuloaga',
  'Paula Fernández': 'Paula Fernández', 'Rosa María Rodríguez': 'Rosa María Rodríguez',
  'María Luz Martínez': 'María Luz Martínez', 'César Zorraquino': 'César Zorraquino',
  'Miguel Ángel Sastre': 'Miguel Ángel Sastre', 'María Teresa Rodríguez': 'María Teresa Rodríguez',
  'José Manuel Cansino': 'José Manuel Cansino', 'Javier Cía': 'Javier Cía (político)',
  'María José Ortego': 'María José Ortego', 'Julián López Milla': 'Julián López Milla',
  'Pedro Saura': 'Pedro Saura', 'Mercedes Gallardo': 'Mercedes Gallardo',
  'Javier de los Nietos': 'Javier de los Nietos', 'María Isabel López': 'María Isabel López',
  'Mario Garcés': 'Mario Garcés', 'María del Mar Fernández': 'María del Mar Fernández',
  'Josefa Andrés': 'Josefa Andrés', 'José Luis Martínez': 'José Luis Martínez (político)',
  'Tomás Valiente': 'Tomás Valiente', 'Rosa María Sánchez': 'Rosa María Sánchez',
  'María del Carmen García': 'María del Carmen García', 'José Manuel López': 'José Manuel López (político)',
  'María Jesús del Río': 'María Jesús del Río', 'Javier Quirós': 'Javier Quirós',
  'María Luisa Carcedo': 'María Luisa Carcedo',
  'Fco. Javier Fernández': 'Francisco Javier Fernández (político)',
  'José Antonio Alonso': 'José Antonio Alonso', 'Carmen Chacón': 'Carmen Chacón',
  'María Teresa Fernández de la Vega': 'María Teresa Fernández de la Vega',
  'Leire Pajín': 'Leire Pajín', 'Valeriano Gómez': 'Valeriano Gómez',
  'Manuel Chaves': 'Manuel Chaves', 'José Antonio Viera': 'José Antonio Viera',
  'Cristina Garmendia': 'Cristina Garmendia',
  'Miguel Sebastián': 'Miguel Sebastián', 'José Enrique Serrano': 'José Enrique Serrano',
  'Juan Fernando López Aguilar': 'Juan Fernando López Aguilar',
  'Trinidad Jiménez': 'Trinidad Jiménez',
  'José Cepeda': 'José Cepeda (político)',
  'Eugenio Nasarre': 'Eugenio Nasarre',
  'Antonio Cantó': 'Antonio Cantó', 'Marta Martín': 'Marta Martín (política)',
  'María del Carmen Pardo': 'María del Carmen Pardo', 'David García': 'David García (político)',
  'Javier Fernández': 'Javier Fernández (político)',
  'José María González': 'José María González (político)',
  'María José Pino': 'María José Pino',
  'Alberto Montero': 'Alberto Montero', 'Nadia Calviño': 'Nadia Calviño',
  'Josep Borrell': 'Josep Borrell', 'Antoni Comín': 'Antoni Comín',
  'Marcela Miranda': 'Marcela Miranda',
  'Cristóbal Montoro': 'Cristóbal Montoro',
  'Luis de Guindos': 'Luis de Guindos',
  'Mariano Rubio': 'Mariano Rubio',
  'José Félix Tezanos': 'José Félix Tezanos',
  'José Miguel': 'José Miguel (político)',
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

async function main() {
  console.log('=== WIKIPEDIA SEED V4 — Round 2 ===\n')
  const start = Date.now()
  const entries = Object.entries(ADDITIONAL).filter(([n]) => n.length > 3)

  // Get existing slugs to skip
  const existing = new Set(db.prepare('SELECT slug FROM politicians').all().map(r => r.slug))
  const filtered = entries.filter(([name]) => !existing.has(makeSlug(name)))
  console.log('New to fetch: ' + filtered.length + ' / ' + entries.length)

  if (filtered.length === 0) {
    console.log('Nothing new to add.')
    db.close(); return
  }

  // Batch fetch
for (let i = 0; i < entries.length; i += 20) {
    const batch = entries.slice(i, i + 20)
    const titles = batch.map(([_, t]) => t).join('|')
    try {
      const params = new URLSearchParams({
        action: 'query', format: 'json', prop: 'extracts',
        exintro: '1', explaintext: '1', exlimit: '20', titles,
      })
      const data = await fetchJson(WIKI_API + '?' + params)
      const pages = data.query?.pages || {}
      const results = {}
      for (const id of Object.keys(pages)) {
        if (id === '-1') continue
        const p = pages[id]
        results[p.title] = (p.extract || '').slice(0, 1500)
      }

      // Insert
      const insertPol = db.prepare(`INSERT OR IGNORE INTO politicians 
        (slug, full_name, display_name, party_id, biography, source)
        VALUES (?, ?, ?, (SELECT id FROM parties WHERE slug = ?), ?, 'wikipedia')`)

      let ins = 0
      for (const [name, wikiTitle] of batch) {
        const ext = results[wikiTitle]
        if (!ext || ext.length < 3) continue
        const party = detectParty(ext)
        try {
          insertPol.run(makeSlug(name), wikiTitle, name, party, ext.slice(0, 1500))
          ins++
        } catch {}
      }
      console.log(`  Batch ${Math.floor(i/50)+1}: +${ins} inserted`)
    } catch {}
    await sleep(800)
  }

  const total = db.prepare('SELECT COUNT(*) as t FROM politicians WHERE source=?').get('wikipedia')
  const all = db.prepare('SELECT COUNT(*) as t FROM politicians').get()
  console.log(`\nTotal seeded: ${total.t} | Total all: ${all.t}`)
  db.close()
  console.log('Time: ' + Math.round((Date.now() - start) / 1000) + 's')
}

main().catch(e => { console.error(e); process.exit(1) })