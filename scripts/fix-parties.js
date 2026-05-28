#!/usr/bin/env node
// Fix party detection for all politicians using better regex + first-sentence only
const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '..', 'db', 'nomemientas.db'))

const RULES = [
  { re: /\bPSOE\b|Partido Socialista Obrero|socialista obrero|secretario general del PSOE/i, slug: 'psoe' },
  { re: /Partido Popular|\bPP\b(?!\s+de\s+PSC)/i, slug: 'pp' },
  { re: /\bVox\b(?:\s+\(?partido\)?)?/i, slug: 'vox' },
  { re: /\bSumar\b|Movimiento Sumar|Más País/i, slug: 'sumar' },
  { re: /\bPodemos\b|Unidas Podemos|secretario general de Podemos/i, slug: 'podemos' },
  { re: /Esquerra Republicana|ERC\b|secretaria general de ERC/i, slug: 'erc' },
  { re: /\bJunts\b|Junts per Catalunya|JxCat|PDeCAT/i, slug: 'junts' },
  { re: /Euskal Herria Bildu|EH Bildu/i, slug: 'eh-bildu' },
  { re: /Partido Nacionalista Vasco|PNV\b|EAJ-PNV/i, slug: 'pnv' },
  { re: /Coalición Canaria|CCa?\b/i, slug: 'cc' },
  { re: /Unión del Pueblo Navarro|UPN\b/i, slug: 'upn' },
  { re: /Bloque Nacionalista Galego|BNG\b/i, slug: 'bng' },
  { re: /\bCiudadanos\b|Ciutadans\b/i, slug: 'cs' },
  { re: /Izquierda Unida\b|IU\b(?!\s+de\s+la)/i, slug: 'iu' },
  { re: /Compromís|Més Compromís/i, slug: 'sumar' },
]

// Also manual overrides for known politicians where detection fails
const MANUAL_PARTY = {
  'elma-saiz': 'psoe',
  'nadia-calvino': 'psoe',
  'mercedes-gonzalez': 'psoe',
  'angel-victor-torres': 'psoe',
  'francina-armengol': 'psoe',
  'rocio-de-meer': 'vox',
  'cristina-esteban': 'vox',
  'cayetana-alvarez-de-toledo': 'pp',
  'javier-maroto': 'pp',
  'maria-dolores-de-cospedal': 'pp',
  'pablo-casado': 'pp',
  'maite-aranburu': 'eh-bildu',
  'mertxe-aizpurua': 'eh-bildu',
  'ana-oramas': 'cc',
  'fernando-clavijo': 'cc',
  'cristina-valido': 'cc',
  'ana-ponton': 'bng',
  'nestor-rego': 'bng',
  'ines-arrimadas': 'cs',
  'albert-rivera': 'cs',
  'adolfo-suarez': 'pp',
  'manuel-azana': 'psoe',
  'santiago-carrillo': 'iu',
  'alfonso-guerra': 'psoe',
  'julio-anguita': 'iu',
  'manuel-fraga': 'pp',
  'cristina-alberdi': 'psoe',
  'gregorio-peces-barba': 'psoe',
  'elena-salgado': 'psoe',
  'carlos-solchaga': 'psoe',
  'miguel-boyer': 'psoe',
  'alberto-ruiz-gallardon': 'pp',
  'federico-trillo': 'pp',
  'luis-de-grandes': 'pp',
  'jose-manuel-garcia-margallo': 'pp',
  'juan-costa-climent': 'pp',
  'celso-villalibre': 'pp',
  'angel-acebes': 'pp',
  'luis-de-la-vega': 'pp',
  'cesar-antonio-molina': 'pp',
  'pedro-antonio-de-la-rosa': 'pp',
  'mariano-rajoy': 'pp',
  'jose-maria-aznar': 'pp',
  'marta-rivera-de-la-cruz': 'cs',
  'juan-marin': 'cs',
  'maria-jose-catala': 'pp',
}

const getPartyId = db.prepare('SELECT id FROM parties WHERE slug = ?')
const getSlug = db.prepare('SELECT slug FROM politicians WHERE id = ?')

const politicians = db.prepare("SELECT id, slug, full_name, biography FROM politicians").all()
let fixed = 0
let manualFixed = 0

for (const p of politicians) {
  if (p.biography) {
    const firstSentence = p.biography.split(/[.!?\n]/)[0]
    
    // Manual override first
    let slug = MANUAL_PARTY[p.slug]
    
    // Then try regex on first sentence
    if (!slug) {
      for (const rule of RULES) {
        if (rule.re.test(firstSentence)) {
          slug = rule.slug
          break
        }
      }
    }
    
    if (slug) {
      const partyRow = getPartyId.get(slug)
      if (partyRow) {
        if (p.slug in MANUAL_PARTY && MANUAL_PARTY[p.slug] === slug) {
          db.prepare('UPDATE politicians SET party_id = ? WHERE id = ?').run(partyRow.id, p.id)
          manualFixed++
        } else {
          db.prepare('UPDATE politicians SET party_id = ? WHERE id = ?').run(partyRow.id, p.id)
          fixed++
        }
      }
    }
  }
}

const withParty = db.prepare('SELECT COUNT(*) as t FROM politicians WHERE party_id IS NOT NULL').get().t
const total = db.prepare('SELECT COUNT(*) as t FROM politicians').get().t
const noParty = db.prepare('SELECT slug, display_name FROM politicians WHERE party_id IS NULL').all()

console.log('Party detection results:')
console.log('  Auto-fixed: ' + fixed)
console.log('  Manual overrides: ' + manualFixed)
console.log('  With party: ' + withParty + '/' + total)
console.log('  Without party: ' + noParty.length)
console.log('\nUnassigned:')
for (const p of noParty.slice(0, 20)) {
  console.log('  ' + p.slug + ' — ' + p.display_name)
}
if (noParty.length > 20) console.log('  ...and ' + (noParty.length - 20) + ' more')

// Ensure all politicians have scores
const noScore = db.prepare(`SELECT id FROM politicians WHERE id NOT IN 
  (SELECT politician_id FROM score_history WHERE score_type = 'composite')`).all()

if (noScore.length > 0) {
  const insScore = db.prepare('INSERT INTO score_history (politician_id, score_type, score, confidence, period, source) VALUES (?, ?, ?, ?, ?, ?)')
  for (const p of noScore) {
    insScore.run(p.id, 'composite', 5.0, 0.3, '2004-2026', 'default')
    insScore.run(p.id, 'honesty', 5.0, 0.3, '2004-2026', 'default')
  }
  console.log('\nDefault scores added for ' + noScore.length + ' politicians')
}

db.close()