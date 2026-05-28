const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db', 'nomemientas.db');
const db = new Database(DB_PATH);

// Newtral Pactocheck data - verified promises
const newtralPromises = [
  // Government coalition promises (PSOE + Sumar)
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Aprobar la ley de representación paritaria en órganos de decisión',
    status: 'kept',
    topic: 'igualdad',
    date_made: '2023-11-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - Balance 50 promesas a un año de Gobierno',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Aprobar la ley de amnistía',
    status: 'kept',
    topic: 'justicia',
    date_made: '2023-11-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - Balance 50 promesas a un año de Gobierno',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Regular el estatuto de bomberos y agentes forestales',
    status: 'kept',
    topic: 'empleo',
    date_made: '2023-11-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - Balance 50 promesas a un año de Gobierno',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Derogar la ley mordaza (Ley de Seguridad Ciudadana)',
    status: 'partial',
    topic: 'derechos',
    date_made: '2023-11-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - En trámite parlamentario',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Aprobar el Estatuto del Becario',
    status: 'partial',
    topic: 'educacion',
    date_made: '2023-11-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - En trámite parlamentario',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Aprobar ley integral contra la trata de seres humanos',
    status: 'partial',
    topic: 'derechos',
    date_made: '2023-11-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - En trámite parlamentario',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Crear cinco nuevos juzgados de violencia sobre la mujer en Galicia',
    status: 'broken',
    topic: 'justicia',
    date_made: '2024-01-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - No cumplido por no tramitar PGE 2024',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Aumentar descuentos en autopistas AP-9 y AP-53 en Galicia',
    status: 'broken',
    topic: 'infraestructuras',
    date_made: '2024-01-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - No cumplido por no tramitar PGE 2024',
  },
  // Previous legislature (PSOE + Podemos)
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Aprobar la ley Trans y LGBTI',
    status: 'kept',
    topic: 'derechos',
    date_made: '2020-01-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - En vigor desde 2/3/2023',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Aprobar la Ley de Familias',
    status: 'kept',
    topic: 'social',
    date_made: '2020-01-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - En trámite parlamentario',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Limitar subidas de alquiler en zonas tensionadas',
    status: 'partial',
    topic: 'vivienda',
    date_made: '2020-01-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - Ley de Vivienda aprobada pero parcial',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Garantizar educación gratuita obligatoria para familias vulnerables',
    status: 'broken',
    topic: 'educacion',
    date_made: '2020-01-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - Declarado prácticamente imposible',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Inversión educativa al 5% del PIB en 2025',
    status: 'broken',
    topic: 'educacion',
    date_made: '2020-01-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - Solo alcanzado 4.4% PIB en 2023',
  },
  {
    politician: 'pedro-sanchez',
    party: 'psoe',
    text: 'Subir IRPF rentas del ahorro superiores a 130.000€ en 3 puntos',
    status: 'broken',
    topic: 'fiscalidad',
    date_made: '2020-01-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - Aplicado solo a partir de 200.000€',
  },
  // Andalusia (PP + Cs)
  {
    politician: 'juanma-moreno',
    party: 'pp',
    text: 'Eliminar aforamientos en Andalucía',
    status: 'broken',
    topic: 'transparencia',
    date_made: '2019-01-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - Promesa incumplida PP y Cs',
  },
  {
    politician: 'juanma-moreno',
    party: 'pp',
    text: 'Reformar la ley electoral en Andalucía',
    status: 'broken',
    topic: 'democracia',
    date_made: '2019-01-01',
    source: 'Newtral Pactocheck',
    source_description: 'Verificado por Newtral - Promesa incumplida PP y Cs',
  },
];

console.log(`Adding ${newtralPromises.length} Newtral verified promises...`);

// Get politician IDs
const getPoliticianId = db.prepare('SELECT id FROM politicians WHERE slug = ?');
const getPartyId = db.prepare('SELECT id FROM parties WHERE slug = ?');

let added = 0;
let skipped = 0;

for (const promise of newtralPromises) {
  const polId = getPoliticianId.get(promise.politician);
  const partyId = getPartyId.get(promise.party);
  
  if (!polId || !partyId) {
    console.log(`Not found: ${promise.politician} (${promise.party})`);
    skipped++;
    continue;
  }
  
  // Check if already exists
  const exists = db.prepare(`
    SELECT id FROM promises_tracker 
    WHERE politician_id = ? AND text = ?
  `).get(polId.id, promise.text);
  
  if (exists) {
    skipped++;
    continue;
  }
  
  // Insert
  db.prepare(`
    INSERT INTO promises_tracker 
    (politician_id, party_id, text, topic, status, date_made, source_url, source_description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    polId.id,
    partyId.id,
    promise.text,
    promise.topic,
    promise.status,
    promise.date_made,
    promise.source,
    promise.source_description
  );
  
  added++;
}

console.log(`Added: ${added}, Skipped: ${skipped}`);

// Update scores based on promises
const promisesByPolitician = db.prepare(`
  SELECT 
    politician_id,
    COUNT(*) as total,
    SUM(CASE WHEN status = 'kept' THEN 1 ELSE 0 END) as kept,
    SUM(CASE WHEN status = 'broken' THEN 1 ELSE 0 END) as broken,
    SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial
  FROM promises_tracker
  WHERE source_url = 'Newtral Pactocheck'
  GROUP BY politician_id
`).all();

console.log(`\nUpdating scores for ${promisesByPolitician.length} politicians...`);

let scoresUpdated = 0;
for (const pol of promisesByPolitician) {
  // Calculate promise-based score (0-10)
  const total = pol.total;
  const kept = pol.kept;
  const broken = pol.broken;
  const partial = pol.partial;
  
  // Weight: kept=1, partial=0.5, broken=0
  const weightedScore = (kept * 1.0 + partial * 0.5 + broken * 0.0) / total;
  const promiseScore = Math.round(weightedScore * 10 * 10) / 10; // 0-10 scale
  
  // Update or insert promise score
  const exists = db.prepare(`
    SELECT id FROM score_history 
    WHERE politician_id = ? AND score_type = 'promises_kept'
  `).get(pol.politician_id);
  
  if (exists) {
    db.prepare(`
      UPDATE score_history 
      SET score = ?, confidence = 0.9, source = 'newtral_scraping'
      WHERE politician_id = ? AND score_type = 'promises_kept'
    `).run(promiseScore, pol.politician_id);
  } else {
    db.prepare(`
      INSERT INTO score_history (politician_id, score_type, score, confidence, source)
      VALUES (?, 'promises_kept', ?, 0.9, 'newtral_scraping')
    `).run(pol.politician_id, promiseScore);
  }
  
  scoresUpdated++;
}

console.log(`Scores updated: ${scoresUpdated}`);

// Final stats
const totalPromises = db.prepare('SELECT COUNT(*) as n FROM promises_tracker').get().n;
const newtralCount = db.prepare("SELECT COUNT(*) as n FROM promises_tracker WHERE source_url = 'Newtral Pactocheck'").get().n;

console.log(`\n=== FINAL STATUS ===`);
console.log(`Total promises: ${totalPromises}`);
console.log(`Newtral verified: ${newtralCount}`);

db.close();
