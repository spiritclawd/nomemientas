#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'nomemientas.db');
const db = new Database(DB_PATH);

// ============================================================
// PART 1: Party detection from biography
// ============================================================

// Map of party slug -> party_id
const SLUG_TO_PARTY_ID = {
  'psoe': 1,
  'pp': 2,
  'vox': 3,
  'sumar': 4,
  'podemos': 5,
  'erc': 6,
  'junts': 7,
  'eh-bildu': 8,
  'pnv': 9,
  'cc': 10,
  'upn': 11,
  'bng': 12,
  'cs': 13,
  'iu': 14,
};

// Better party detection patterns
// Uses word boundaries for short acronyms to avoid false positives
const DETECTION_RULES = [
  {
    slug: 'psoe',
    regex: /PSOE|Partido Socialista|socialista obrero|socialista\b/i,
    desc: 'PSOE / Partido Socialista / socialista',
  },
  {
    slug: 'pp',
    regex: /Partido Popular|popular español/i,
    excludeIf: /socialista/i,
    desc: 'Partido Popular',
  },
  {
    slug: 'vox',
    regex: /Vox|VOX/i,
    desc: 'Vox',
  },
  {
    slug: 'sumar',
    regex: /Sumar|Movimiento Sumar/i,
    desc: 'Sumar',
  },
  {
    slug: 'podemos',
    regex: /Podemos|Unidas Podemos/i,
    desc: 'Podemos',
  },
  {
    slug: 'erc',
    regex: /\bERC\b|Esquerra Republicana/i,
    desc: 'ERC',
  },
  {
    slug: 'junts',
    regex: /Junts|Junts per Catalunya/i,
    desc: 'Junts',
  },
  {
    slug: 'eh-bildu',
    regex: /EH Bildu|Euskal Herria Bildu/i,
    desc: 'EH Bildu',
  },
  {
    slug: 'pnv',
    regex: /\bPNV\b|Partido Nacionalista Vasco/i,
    desc: 'PNV',
  },
  {
    slug: 'cs',
    regex: /Ciudadanos|Ciutadans/i,
    desc: 'Ciudadanos',
  },
  {
    slug: 'iu',
    regex: /\bIU\b|Izquierda Unida/i,
    desc: 'Izquierda Unida',
  },
  {
    slug: 'bng',
    regex: /BNG|Bloque Nacionalista Galego/i,
    desc: 'BNG',
  },
];

// Helper: extract first sentence
function getFirstSentence(bio) {
  if (!bio) return '';
  const periodIdx = bio.indexOf('.');
  if (periodIdx >= 0) {
    return bio.substring(0, periodIdx + 1);
  }
  return bio;
}

// Detect party: check first sentence first, fall back to full bio for null-party politicians
function detectParty(firstSentence, fullBio) {
  for (const rule of DETECTION_RULES) {
    if (rule.regex.test(firstSentence)) {
      if (rule.excludeIf && rule.excludeIf.test(firstSentence)) continue;
      return { slug: rule.slug, source: 'first_sentence', match: firstSentence.match(rule.regex)[0] };
    }
  }
  // Fall back to full bio
  if (fullBio) {
    for (const rule of DETECTION_RULES) {
      if (rule.regex.test(fullBio)) {
        if (rule.excludeIf && rule.excludeIf.test(fullBio)) continue;
        return { slug: rule.slug, source: 'full_bio', match: fullBio.match(rule.regex)[0] };
      }
    }
  }
  return null;
}

// Read all politicians
const politicians = db.prepare('SELECT id, full_name, biography, party_id FROM politicians ORDER BY id').all();
const totalPoliticians = politicians.length;

console.log('=== PARTY DETECTION ===');
console.log(`Total politicians: ${totalPoliticians}`);
console.log('');

// Track stats
let alreadyAssigned = 0;
let fixedByFirstSentence = 0;
let fixedByFullBio = 0;
let stillNull = 0;

// Check all politicians
for (const p of politicians) {
  const firstSentence = getFirstSentence(p.biography);
  const fullBio = p.biography || '';
  const result = detectParty(firstSentence, fullBio);
  
  if (!result) {
    if (p.party_id === null) {
      stillNull++;
      console.log(`  NO DETECT: ${String(p.id).padStart(3)} ${p.full_name.padEnd(40)} (was null)`);
    } else {
      alreadyAssigned++;
    }
    continue;
  }
  
  const detectedPartyId = SLUG_TO_PARTY_ID[result.slug];
  const sourceTag = result.source === 'first_sentence' ? 'FS' : 'BIO';
  
  if (p.party_id === null) {
    // WAS null, now fixed
    console.log(`  FIX [${sourceTag}]: ${String(p.id).padStart(3)} ${p.full_name.padEnd(40)} -> ${result.slug} (was null${result.match ? ', matched: "' + result.match + '"' : ''})`);
    db.prepare('UPDATE politicians SET party_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(detectedPartyId, p.id);
    if (result.source === 'first_sentence') {
      fixedByFirstSentence++;
    } else {
      fixedByFullBio++;
    }
  } else if (p.party_id !== detectedPartyId) {
    // Wrong assignment
    console.log(`  FIX [${sourceTag}]: ${String(p.id).padStart(3)} ${p.full_name.padEnd(40)} -> ${result.slug} (was party_id=${p.party_id}, matched: "${result.match}")`);
    db.prepare('UPDATE politicians SET party_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(detectedPartyId, p.id);
    if (result.source === 'first_sentence') {
      fixedByFirstSentence++;
    } else {
      fixedByFullBio++;
    }
  } else {
    // Already correct
    alreadyAssigned++;
  }
}

console.log('');
console.log('Party detection summary:');
console.log(`  Already correctly assigned: ${alreadyAssigned}`);
console.log(`  Fixed from first sentence regex: ${fixedByFirstSentence}`);
console.log(`  Fixed from full bio regex: ${fixedByFullBio}`);
console.log(`  Total fixed: ${fixedByFirstSentence + fixedByFullBio}`);
console.log(`  Still null (no detection): ${stillNull}`);

// ============================================================
// PART 2: Default scores for politicians without them
// ============================================================

console.log('');
console.log('=== DEFAULT SCORES ===');

// Find politicians without score_history entries
const withScores = db.prepare('SELECT DISTINCT politician_id FROM score_history').all();
const withScoreIds = new Set(withScores.map(r => r.politician_id));

const allPoliticianIds = db.prepare('SELECT id FROM politicians').all();
let addedScores = 0;

const insertScore = db.prepare(
  `INSERT INTO score_history (politician_id, party_id, score_type, score, confidence, factors, source)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

for (const p of allPoliticianIds) {
  if (!withScoreIds.has(p.id)) {
    const pol = db.prepare('SELECT party_id FROM politicians WHERE id = ?').get(p.id);
    const partyId = pol ? pol.party_id : null;
    
    insertScore.run(p.id, partyId, 'composite', 5.0, 0.0, '{}', 'system');
    insertScore.run(p.id, partyId, 'honesty', 5.0, 0.0, '{}', 'system');
    
    addedScores++;
    console.log(`  Added scores for politician_id=${p.id}`);
  }
}

console.log('');
console.log(`Politicians with scores added: ${addedScores}`);

// ============================================================
// FINAL SUMMARY
// ============================================================

console.log('');
console.log('=== FINAL SUMMARY ===');

const totalPol = db.prepare('SELECT COUNT(*) as c FROM politicians').get().c;
const withParty = db.prepare('SELECT COUNT(*) as c FROM politicians WHERE party_id IS NOT NULL').get().c;
const withoutParty = db.prepare('SELECT COUNT(*) as c FROM politicians WHERE party_id IS NULL').get().c;
const totalWithScores = db.prepare('SELECT COUNT(DISTINCT politician_id) as c FROM score_history').get().c;

console.log(`Total politicians: ${totalPol}`);
console.log(`With party: ${withParty}`);
console.log(`Without party: ${withoutParty}`);
console.log(`With scores: ${totalWithScores}`);

db.close();