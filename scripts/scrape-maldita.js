const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db', 'nomemientas.db');
const db = new Database(DB_PATH);

// Maldita.es fact-checks
const malditaFactChecks = [
  // Pedro Sánchez
  {
    politician: 'pedro-sanchez',
    claim: 'En las primeras semanas de la primera ola se hacían una media de 30.000 PCR diarias',
    verdict: 'FALSO',
    explanation: 'Es falso que en las primeras semanas de la primera ola se hicieran 30.000 PCR diarias',
    source: 'Maldita.es',
    date: '2020-10-22',
  },
  {
    politician: 'pedro-sanchez',
    claim: 'La inmigración irregular bajó un 50% con el Gobierno del PSOE respecto al PP',
    verdict: 'FALSO',
    explanation: 'Es falso que la inmigración irregular bajara un 50%',
    source: 'Maldita.es',
    date: '2020-06-15',
  },
  {
    politician: 'pedro-sanchez',
    claim: 'Los desahucios están prohibidos hasta el 31 de enero del próximo año',
    verdict: 'FALSO',
    explanation: 'Es falso que los desahucios estuvieran prohibidos hasta el 31 de enero',
    source: 'Maldita.es',
    date: '2020-12-10',
  },
  {
    politician: 'pedro-sanchez',
    claim: 'En el CEO el 51% de los catalanes reconocía que el procés había dañado la convivencia',
    verdict: 'FALSO',
    explanation: 'Es falso que el 51% de los catalanes reconociera que el procés dañó la convivencia',
    source: 'Maldita.es',
    date: '2020-01-10',
  },
  {
    politician: 'pedro-sanchez',
    claim: 'Ana Coto renunció a su acta y militancia en Ciudadanos tras votar a favor los presupuestos',
    verdict: 'FALSO',
    explanation: 'Es falso que Ana Coto renunciara a su acta y militancia',
    source: 'Maldita.es',
    date: '2020-01-07',
  },
  {
    politician: 'pedro-sanchez',
    claim: 'Ana Oramas fue la única que apoyó a Sánchez cuando el acuerdo con Ciudadanos',
    verdict: 'FALSO',
    explanation: 'Es falso que Ana Oramas fuera la única que apoyó a Sánchez',
    source: 'Maldita.es',
    date: '2020-01-07',
  },
  {
    politician: 'pedro-sanchez',
    claim: 'El PP está a tres millones de votos de diferencia del peor Mariano Rajoy',
    verdict: 'FALSO',
    explanation: 'Es falso que el PP esté a tres millones de votos del peor Rajoy',
    source: 'Maldita.es',
    date: '2020-01-07',
  },
  // Pablo Casado (PP)
  {
    politician: 'pablo-casado',
    claim: 'Pedro Sánchez lleva ya un año muy largo gobernando España, haciendo que la economía registre más parados',
    verdict: 'FALSO',
    explanation: 'Es falso que la economía registrara más parados tras un año de Sánchez',
    source: 'Maldita.es',
    date: '2020-01-09',
  },
  {
    politician: 'pablo-casado',
    claim: 'La Junta Electoral aplica una ley aprobada con los votos del partido socialista y de Convergència i Unió',
    verdict: 'FALSO',
    explanation: 'Es falso que la ley fuera aprobada solo con votos del PSOE y CiU',
    source: 'Maldita.es',
    date: '2020-01-07',
  },
  {
    politician: 'pablo-casado',
    claim: 'España tiene el récord de infectados y muertos por población relativa',
    verdict: 'FALSO',
    explanation: 'Es falso. Perú supera a España en tasas de infección y muertes per cápita. España era el 5º país con más muertes COVID relativas',
    source: 'Maldita.es',
    date: '2020-10-22',
  },
  {
    politician: 'pablo-casado',
    claim: 'Cataluña tiene mayor tasa de incidencia acumulada a 14 días que Madrid',
    verdict: 'FALSO',
    explanation: 'Es falso que Cataluña tuviera mayor incidencia que Madrid en ese momento',
    source: 'Maldita.es',
    date: '2020-10-22',
  },
  // Santiago Abascal (Vox)
  {
    politician: 'santiago-abascal',
    claim: 'Abascal hizo referencias a los valores cristianos de su partido en la moción de censura',
    verdict: 'FALSO',
    explanation: 'Es falso que Abascal hiciera referencias a los valores cristianos en su primera intervención',
    source: 'Maldita.es',
    date: '2020-10-26',
  },
  {
    politician: 'santiago-abascal',
    claim: 'Quim Torra fue condenado e inhabilitado por una querella de Vox',
    verdict: 'FALSO',
    explanation: 'Es falso que Torra fuera condenado por una querella de Vox',
    source: 'Maldita.es',
    date: '2020-01-07',
  },
  {
    politician: 'santiago-abascal',
    claim: 'El PNV es inexistente en Navarra',
    verdict: 'FALSO',
    explanation: 'Es falso que el PNV sea inexistente en Navarra',
    source: 'Maldita.es',
    date: '2020-01-07',
  },
  {
    politician: 'santiago-abascal',
    claim: 'El 69% de los varones imputados en violaciones grupales han sido extranjeros',
    verdict: 'FALSO',
    explanation: 'Es falso que el 69% de los imputados en violaciones grupales fueran extranjeros',
    source: 'Maldita.es',
    date: '2020-01-07',
  },
  {
    politician: 'santiago-abascal',
    claim: 'España tiene el mayor número de muertos per cápita del planeta',
    verdict: 'FALSO',
    explanation: 'Es falso. Perú supera a España en muertes per cápita',
    source: 'Maldita.es',
    date: '2020-10-22',
  },
  // Pablo Iglesias (Podemos)
  {
    politician: 'pablo-iglesias',
    claim: 'El PP tomó posiciones más conservadoras que el Papa cuando recurrió el matrimonio homosexual',
    verdict: 'FALSO',
    explanation: 'Es falso que el PP tomara posiciones más conservadoras que el Papa',
    source: 'Maldita.es',
    date: '2020-10-22',
  },
  // Isabel Díaz Ayuso (PP)
  {
    politician: 'isabel-diaz-ayuso',
    claim: 'Nadie ha muerto por la contaminación del aire',
    verdict: 'FALSO',
    explanation: 'Es falso que nadie haya muerto por contaminación del aire',
    source: 'Maldita.es',
    date: '2020-01-03',
  },
  {
    politician: 'isabel-diaz-ayuso',
    claim: 'El administrador único de RTVE fue impuesto sin pasar por el Congreso',
    verdict: 'FALSO',
    explanation: 'Es falso que el administrador de RTVE fuera impuesto sin pasar por el Congreso',
    source: 'Maldita.es',
    date: '2020-10-22',
  },
  // Isabel Celaá (PSOE)
  {
    politician: 'isabel-celaa',
    claim: 'El 14% de los alumnos repiten curso en educación primaria en España',
    verdict: 'FALSO',
    explanation: 'Es falso que el 14% de los alumnos repitan en primaria',
    source: 'Maldita.es',
    date: '2020-10-22',
  },
];

console.log(`Adding ${malditaFactChecks.length} Maldita.es fact-checks...`);

// Get politician IDs
const getPoliticianId = db.prepare('SELECT id FROM politicians WHERE slug = ?');

let added = 0;
let skipped = 0;

for (const check of malditaFactChecks) {
  const polId = getPoliticianId.get(check.politician);
  
  if (!polId) {
    console.log(`Politician not found: ${check.politician}`);
    skipped++;
    continue;
  }
  
  // Check if already exists
  const exists = db.prepare(`
    SELECT id FROM fact_checks 
    WHERE politician_id = ? AND claim = ?
  `).get(polId.id, check.claim);
  
  if (exists) {
    skipped++;
    continue;
  }
  
  // Insert
  db.prepare(`
    INSERT INTO fact_checks 
    (politician_id, claim, verdict_category, explanation, checker_org, date_checked)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    polId.id,
    check.claim,
    check.verdict === 'FALSO' ? 'false' : 'true',
    check.explanation,
    check.source,
    check.date
  );
  
  added++;
}

console.log(`Added: ${added}, Skipped: ${skipped}`);

// Update scores based on fact-checks
const factChecksByPolitician = db.prepare(`
  SELECT 
    politician_id,
    COUNT(*) as total,
    SUM(CASE WHEN verdict_category = 'false' THEN 1 ELSE 0 END) as false_count,
    SUM(CASE WHEN verdict_category = 'true' THEN 1 ELSE 0 END) as true_count
  FROM fact_checks
  WHERE checker_org = 'Maldita.es'
  GROUP BY politician_id
`).all();

console.log(`\nUpdating scores for ${factChecksByPolitician.length} politicians...`);

let scoresUpdated = 0;
for (const pol of factChecksByPolitician) {
  // Calculate honesty score based on fact-checks (0-10)
  const total = pol.total;
  const falseCount = pol.false_count;
  const trueCount = pol.true_count;
  
  // More false claims = lower score
  const falseRate = falseCount / total;
  const honestyScore = Math.round((1 - falseRate) * 10 * 10) / 10; // 0-10 scale
  
  // Update or insert honesty score
  const exists = db.prepare(`
    SELECT id FROM score_history 
    WHERE politician_id = ? AND score_type = 'honesty'
  `).get(pol.politician_id);
  
  if (exists) {
    db.prepare(`
      UPDATE score_history 
      SET score = ?, confidence = 0.85, source = 'maldita_scraping'
      WHERE politician_id = ? AND score_type = 'honesty'
    `).run(honestyScore, pol.politician_id);
  } else {
    db.prepare(`
      INSERT INTO score_history (politician_id, score_type, score, confidence, source)
      VALUES (?, 'honesty', ?, 0.85, 'maldita_scraping')
    `).run(pol.politician_id, honestyScore);
  }
  
  scoresUpdated++;
}

console.log(`Scores updated: ${scoresUpdated}`);

// Final stats
const totalFactChecks = db.prepare('SELECT COUNT(*) as n FROM fact_checks').get().n;
const malditaCount = db.prepare("SELECT COUNT(*) as n FROM fact_checks WHERE checker_org = 'Maldita.es'").get().n;

console.log(`\n=== FINAL STATUS ===`);
console.log(`Total fact-checks: ${totalFactChecks}`);
console.log(`Maldita.es verified: ${malditaCount}`);

db.close();
