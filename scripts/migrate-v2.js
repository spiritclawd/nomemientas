#!/usr/bin/env node
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '..', 'db', 'nomemientas.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

console.log('[MIGRATE-V2] Expanding schema...')

db.exec(`
  CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT DEFAULT '',
    color TEXT DEFAULT '#888888',
    founded_year INTEGER DEFAULT NULL,
    dissolved_year INTEGER DEFAULT NULL,
    ideology TEXT DEFAULT '',
    description TEXT DEFAULT '',
    wikipedia_url TEXT DEFAULT '',
    logo_url TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS politicians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    party_id INTEGER REFERENCES parties(id),
    party_affiliations TEXT DEFAULT '[]',
    birth_date TEXT DEFAULT '',
    birth_place TEXT DEFAULT '',
    biography TEXT DEFAULT '',
    wikipedia_url TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    current_position TEXT DEFAULT '',
    positions TEXT DEFAULT '[]',
    legislatures TEXT DEFAULT '[]',
    education TEXT DEFAULT '[]',
    source TEXT DEFAULT 'wikipedia',
    source_data TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS promises_tracker (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    politician_id INTEGER REFERENCES politicians(id),
    party_id INTEGER REFERENCES parties(id),
    text TEXT NOT NULL,
    topic TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'pending' CHECK(status IN ('kept', 'broken', 'pending', 'partial', 'unknown')),
    date_made TEXT DEFAULT '',
    date_due TEXT DEFAULT '',
    date_resolved TEXT DEFAULT '',
    source_url TEXT DEFAULT '',
    source_description TEXT DEFAULT '',
    evidence_url TEXT DEFAULT '',
    verification TEXT DEFAULT '',
    analysis_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_promises_politician ON promises_tracker(politician_id);
  CREATE INDEX IF NOT EXISTS idx_promises_party ON promises_tracker(party_id);
  CREATE INDEX IF NOT EXISTS idx_promises_status ON promises_tracker(status);

  CREATE TABLE IF NOT EXISTS legislation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boe_id TEXT UNIQUE DEFAULT '',
    title TEXT NOT NULL,
    type TEXT DEFAULT 'ley',
    department TEXT DEFAULT '',
    date_published TEXT DEFAULT '',
    date_effective TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    full_url TEXT DEFAULT '',
    category TEXT DEFAULT '',
    topics TEXT DEFAULT '[]',
    governing_party TEXT DEFAULT '',
    proposing_party TEXT DEFAULT '',
    voted_by TEXT DEFAULT '[]',
    result TEXT DEFAULT '',
    is_repealed INTEGER DEFAULT 0,
    repealed_by TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_legislation_date ON legislation(date_published);

  CREATE TABLE IF NOT EXISTS congress_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT DEFAULT '',
    date TEXT DEFAULT '',
    topic TEXT DEFAULT '',
    proposal TEXT DEFAULT '',
    proposal_type TEXT DEFAULT 'ley',
    result TEXT DEFAULT '',
    yes_votes INTEGER DEFAULT 0,
    no_votes INTEGER DEFAULT 0,
    abstain_votes INTEGER DEFAULT 0,
    party_votes TEXT DEFAULT '{}',
    url TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fact_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    politician_id INTEGER REFERENCES politicians(id),
    party_id INTEGER REFERENCES parties(id),
    claim TEXT NOT NULL,
    verdict TEXT DEFAULT '',
    verdict_category TEXT DEFAULT 'false' CHECK(verdict_category IN ('true', 'mostly_true', 'half_true', 'mostly_false', 'false', 'out_of_context', 'unverifiable', 'pants_on_fire')),
    source_url TEXT DEFAULT '',
    checker TEXT DEFAULT '',
    checker_org TEXT DEFAULT '',
    date_checked TEXT DEFAULT '',
    topic TEXT DEFAULT '',
    explanation TEXT DEFAULT '',
    analysis_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fchecks_politician ON fact_checks(politician_id);
  CREATE INDEX IF NOT EXISTS idx_fchecks_verdict ON fact_checks(verdict_category);

  CREATE TABLE IF NOT EXISTS score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    politician_id INTEGER REFERENCES politicians(id),
    party_id INTEGER REFERENCES parties(id),
    score_type TEXT DEFAULT 'composite' CHECK(score_type IN ('composite', 'honesty', 'promises_kept', 'transparency', 'consistency')),
    score REAL NOT NULL DEFAULT 5.0,
    confidence REAL DEFAULT 0.0,
    factors TEXT DEFAULT '{}',
    period TEXT DEFAULT '',
    source TEXT DEFAULT 'system',
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_score_politician ON score_history(politician_id, score_type);
  CREATE INDEX IF NOT EXISTS idx_score_party ON score_history(party_id, score_type);

  CREATE TABLE IF NOT EXISTS media_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    politician_id INTEGER REFERENCES politicians(id),
    party_id INTEGER REFERENCES parties(id),
    title TEXT DEFAULT '',
    source TEXT DEFAULT '',
    source_url TEXT DEFAULT '',
    date TEXT DEFAULT '',
    type TEXT DEFAULT 'article' CHECK(type IN ('article', 'interview', 'debate', 'speech', 'tweet', 'tv', 'other')),
    snippet TEXT DEFAULT '',
    bias TEXT DEFAULT '',
    topic TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_media_politician ON media_references(politician_id);

  CREATE TABLE IF NOT EXISTS speech_analysis_agg (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    politician_id INTEGER REFERENCES politicians(id),
    party_id INTEGER REFERENCES parties(id),
    period TEXT NOT NULL,
    year INTEGER NOT NULL,
    quarter INTEGER DEFAULT 0,
    total_analyses INTEGER DEFAULT 0,
    avg_honesty REAL DEFAULT 0,
    total_promises INTEGER DEFAULT 0,
    total_facts INTEGER DEFAULT 0,
    total_attacks INTEGER DEFAULT 0,
    total_opinions INTEGER DEFAULT 0,
    avg_verifiability REAL DEFAULT 0,
    top_topics TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_saa_politician ON speech_analysis_agg(politician_id, year, quarter);

  ALTER TABLE analyses ADD COLUMN politician_id INTEGER DEFAULT NULL REFERENCES politicians(id);
  ALTER TABLE analyses ADD COLUMN party_id INTEGER DEFAULT NULL REFERENCES parties(id);
  ALTER TABLE analyses ADD COLUMN analysis_version INTEGER DEFAULT 2;
`)

console.log('[MIGRATE-V2] Schema expanded successfully')

// Seed parties
console.log('[MIGRATE-V2] Seeding parties...')
const insertParty = db.prepare('INSERT OR IGNORE INTO parties (slug, name, short_name, color, founded_year, ideology, description) VALUES (?, ?, ?, ?, ?, ?, ?)')

const partyData = [
  ['psoe','Partido Socialista Obrero Espanol','PSOE','#e30613',1879,'Socialdemocracia, Progresismo','Fundado en 1879.'],
  ['pp','Partido Popular','PP','#1d84ce',1989,'Conservadurismo, Democracia cristiana','Fundado en 1989.'],
  ['vox','Vox','Vox','#5ac035',2013,'Conservadurismo nacionalista, Derecha radical','Fundado en 2013.'],
  ['sumar','Sumar','Sumar','#e11b4e',2022,'Progresismo, Ecologia politica','Coalicion liderada por Yolanda Diaz.'],
  ['podemos','Podemos','Podemos','#622eb2',2014,'Izquierda radical, Populismo','Fundado en 2014.'],
  ['erc','Esquerra Republicana de Catalunya','ERC','#ffb612',1931,'Independentismo catalan, Socialdemocracia','Partido independentista catalan.'],
  ['junts','Junts per Catalunya','Junts','#003153',2017,'Independentismo catalan, Liberalismo','Partido independentista catalan.'],
  ['eh-bildu','Euskal Herria Bildu','EH Bildu','#a2cc54',2012,'Independentismo vasco, Izquierda','Coalicion independentista vasca.'],
  ['pnv','Partido Nacionalista Vasco','PNV','#008000',1895,'Nacionalismo vasco, Democracia cristiana','Fundado por Sabino Arana.'],
  ['cc','Coalicion Canaria','CC','#ffd700',1993,'Nacionalismo canario, Centrismo','Coalicion nacionalista canaria.'],
  ['upn','Union del Pueblo Navarro','UPN','#c8102e',1979,'Navarrismo, Conservadurismo','Partido navarro.'],
  ['bng','Bloque Nacionalista Galego','BNG','#5b9e4f',1982,'Nacionalismo gallego, Izquierda','Frente nacionalista gallego.'],
  ['cs','Ciudadanos','CS','#ff4500',2006,'Liberalismo, Unionismo','Partido liberal fundado en Cataluna.'],
  ['iu','Izquierda Unida','IU','#a52a2a',1986,'Socialismo, Comunismo','Coalicion de partidos.'],
]

for (const p of partyData) {
  insertParty.run(...p)
}
console.log('[MIGRATE-V2] Seeded ' + partyData.length + ' parties')

// Insert core politicians
console.log('[MIGRATE-V2] Seeding core politicians...')
const insertPol = db.prepare('INSERT OR IGNORE INTO politicians (slug, full_name, display_name, party_id, current_position, birth_date, biography, source) VALUES (?, ?, ?, (SELECT id FROM parties WHERE slug = ?), ?, ?, ?, ?)')

const polData = [
  ['pedro-sanchez','Pedro Sanchez Perez-Castejon','Pedro Sanchez','psoe','Presidente del Gobierno (2018-)','1972-02-29','Economista y politico, Presidente del Gobierno desde 2018.','manual'],
  ['alberto-nunez-feijoo','Alberto Nunez Feijoo','Alberto Nunez Feijoo','pp','Presidente del PP (2022-)','1961-09-10','Jurista, ex-Presidente de la Xunta de Galicia.','manual'],
  ['santiago-abascal','Santiago Abascal Conde','Santiago Abascal','vox','Presidente de Vox (2014-)','1976-04-17','Politico, fundador de Vox.','manual'],
  ['yolanda-diaz','Yolanda Diaz Perez','Yolanda Diaz','sumar','Vicepresidenta segunda y Ministra de Trabajo','1971-05-06','Abogada laboralista, lider de Sumar.','manual'],
  ['pablo-iglesias','Pablo Iglesias Turrion','Pablo Iglesias','podemos','Ex-Vicepresidente del Gobierno','1978-10-17','Politologo, fundador de Podemos.','manual'],
  ['salvador-illa','Salvador Illa Roca','Salvador Illa','psoe','Presidente de la Generalitat (2024-)','1966-05-05','ExMinistro de Sanidad.','manual'],
  ['isabel-diaz-ayuso','Isabel Diaz Ayuso','Isabel Diaz Ayuso','pp','Presidenta de la Comunidad de Madrid (2019-)','1978-10-17','Presidenta de la Comunidad de Madrid.','manual'],
  ['patxi-lopez','Patxi Lopez Alvarez','Patxi Lopez','psoe','Portavoz del PSOE en el Congreso','1959-10-04','ExLehendakari.','manual'],
  ['cuca-gamarra','Concepcion Gamarra Ruiz-Clavijo','Cuca Gamarra','pp','Portavoz del PP en el Congreso','1977-01-12','Abogada y politica.','manual'],
  ['carles-puigdemont','Carles Puigdemont i Casamajo','Carles Puigdemont','junts','Lider de Junts','1962-12-29','ExPresident de la Generalitat.','manual'],
  ['gabriel-rufian','Gabriel Rufian Romero','Gabriel Rufian','erc','Diputado de ERC','1982-06-08','Politico, portavoz de ERC.','manual'],
  ['margarita-robles','Margarita Robles Fernandez','Margarita Robles','psoe','Ministra de Defensa','1956-11-10','Jueza y politica.','manual'],
  ['fernando-grande-marlaska','Fernando Grande-Marlaska Gomez','Fernando Grande-Marlaska','psoe','Ministro del Interior','1962-07-26','Juez y politico.','manual'],
  ['jose-luis-martinez-almeida','Jose Luis Martinez-Almeida','Jose Luis Martinez-Almeida','pp','Alcalde de Madrid','1975-04-17','Abogado del Estado.','manual'],
  ['pere-aragones','Pere Aragones i Garcia','Pere Aragones','erc','Expresident de la Generalitat','1982-11-16','Politico.','manual'],
  ['maria-jesus-montero','Maria Jesus Montero Cuadrado','Maria Jesus Montero','psoe','Vicepresidenta primera y Ministra de Hacienda','1966-02-04','Medica y politica.','manual'],
  ['felix-bolanos','Felix Bolanos Garcia','Felix Bolanos','psoe','Ministro de Presidencia','1975-12-03','Abogado del Estado.','manual'],
  ['borja-semper','Borja Semper Pascual','Borja Semper','pp','Portavoz adjunto del PP','1976-01-12','Politico.','manual'],
  ['marta-lois','Marta Lois Gonzalez','Marta Lois','sumar','Diputada de Sumar','1977-12-23','Politica.','manual'],
  ['oscar-puente','Oscar Puente Santiago','Oscar Puente','psoe','Ministro de Transportes','1968-10-14','Abogado, exAlcalde de Valladolid.','manual'],
  ['diana-morant','Diana Morant Ripoll','Diana Morant','psoe','Ministra de Ciencia','1980-08-05','Ingeniera y politica.','manual'],
  ['pilar-alegria','Pilar Alegria Continente','Pilar Alegria','psoe','Ministra de Educacion','1974-05-22','Politica.','manual'],
  ['monica-garcia','Monica Garcia Gomez','Monica Garcia','sumar','Ministra de Sanidad','1974-03-26','Medica y politica.','manual'],
  ['ionebelarra','Ione Belarra Urteaga','Ione Belarra','podemos','Secretaria General de Podemos','1987-09-25','Psicologa y politica.','manual'],
]

for (const p of polData) {
  insertPol.run(...p)
}
console.log('[MIGRATE-V2] Seeded ' + polData.length + ' core politicians')

// Seed promises
console.log('[MIGRATE-V2] Seeding historical promises...')
const insertPromise = db.prepare('INSERT OR IGNORE INTO promises_tracker (politician_id, party_id, text, topic, status, date_made, date_due, source_description) VALUES ((SELECT id FROM politicians WHERE slug = ?), (SELECT id FROM parties WHERE slug = ?), ?, ?, ?, ?, ?, ?)')

const promisesData = [
  ['pedro-sanchez','psoe','Subir el SMI a 1.000 euros/mes en 14 pagas','economia','partial','2019-01-10','2023-12-31','Programa PSOE 2019'],
  ['pedro-sanchez','psoe','Derogar la reforma laboral del PP','trabajo','kept','2018-06-01','2021-12-28','Mocion de censura 2018'],
  ['pedro-sanchez','psoe','Reforma de la financiacion autonomica','autonomias','broken','2019-01-01','2024-12-31','Acuerdo investidura 2020'],
  ['alberto-nunez-feijoo','pp','Bajar el IRPF para rentas medias y bajas','economia','pending','2023-07-01','2025-12-31','Programa PP 2023'],
  ['alberto-nunez-feijoo','pp','Suprimir el Ministerio de Igualdad','instituciones','pending','2023-07-01','2025-12-31','Programa PP 2023'],
  ['santiago-abascal','vox','Derogar la Ley de Memoria Democratica','memoria','pending','2023-07-01','2025-12-31','Programa Vox 2023'],
  ['yolanda-diaz','sumar','Jornada laboral de 37.5h semanales','trabajo','pending','2023-07-01','2025-12-31','Programa Sumar 2023'],
  ['yolanda-diaz','sumar','Reduccion de jornada a 32h semanales','trabajo','pending','2023-07-01','2028-12-31','Programa Sumar 2023'],
  ['pablo-iglesias','podemos','Referendum sobre la monarquia','instituciones','broken','2015-12-20','2020-12-31','Programa Podemos 2015'],
  ['salvador-illa','psoe','Concierto economico singular para Catalunya','autonomias','kept','2023-10-01','2024-11-09','Acuerdo PSOE-ERC 2023'],
  ['isabel-diaz-ayuso','pp','Bajada del tramo autonomico del IRPF','economia','kept','2019-07-01','2020-01-01','Medidas fiscales Madrid'],
  ['carles-puigdemont','junts','Independencia de Catalunya para 2017','soberania','broken','2016-01-01','2017-12-31','Hoja de ruta JxSi 2015'],
  ['patxi-lopez','psoe','Reforma de la Ley de Seguridad Ciudadana','justicia','partial','2019-01-01','2023-12-31','Acuerdo de Gobierno'],
  ['maria-jesus-montero','psoe','Reforma de financiacion autonomica','autonomias','broken','2019-01-01','2024-12-31','Compromiso legislatura'],
]

for (const p of promisesData) {
  insertPromise.run(...p)
}
console.log('[MIGRATE-V2] Seeded ' + promisesData.length + ' promises')

// Seed legislation
console.log('[MIGRATE-V2] Seeding key legislation...')
const insertLeg = db.prepare('INSERT OR IGNORE INTO legislation (title, type, date_published, summary, category, governing_party, topics) VALUES (?, ?, ?, ?, ?, ?, ?)')

const legData = [
  ['Ley 3/2020 de Educacion (LOMLOE)','ley','2020-12-29','Nueva ley educativa que derogo la LOMCE.','educacion','PSOE','["educacion"]'],
  ['Ley 2/2021 de Memoria Democratica','ley','2021-10-11','Ley de memoria sobre el franquismo.','memoria','PSOE','["memoria"]'],
  ['Real Decreto-ley 32/2021 de Reforma Laboral','ley','2021-12-28','Reforma laboral que derogo elementos de la reforma de 2012.','trabajo','PSOE','["trabajo"]'],
  ['Ley 4/2023 de Paridad','ley','2023-02-28','Ley de representacion paritaria.','igualdad','PSOE','["igualdad"]'],
  ['Ley Organica 2/2024 de Amnistia','ley','2024-06-11','Ley de amnistia para la normalizacion en Catalunya.','justicia','PSOE','["amnistia"]'],
  ['Ley 3/2012 de reforma laboral','ley','2012-07-06','Reforma laboral del gobierno de Rajoy.','trabajo','PP','["trabajo"]'],
  ['Ley Organica 8/2013 (LOMCE)','ley','2013-12-09','Reforma educativa del PP, conocida como Ley Wert.','educacion','PP','["educacion"]'],
  ['Ley 19/2013 de transparencia','ley','2013-12-09','Ley de transparencia y buen gobierno.','transparencia','PP','["transparencia"]'],
]

for (const l of legData) {
  insertLeg.run(...l)
}
console.log('[MIGRATE-V2] Seeded ' + legData.length + ' legislation items')

// Seed scores
console.log('[MIGRATE-V2] Seeding initial scores...')
const insertScore = db.prepare('INSERT INTO score_history (politician_id, score_type, score, confidence, period, source) VALUES ((SELECT id FROM politicians WHERE slug = ?), ?, ?, ?, ?, ?)')

const scoreData = [
  ['pedro-sanchez','composite',5.1,0.7,'2004-2026','seed'],
  ['pedro-sanchez','honesty',5.3,0.7,'2004-2026','seed'],
  ['pedro-sanchez','promises_kept',4.5,0.6,'2004-2026','seed'],
  ['alberto-nunez-feijoo','composite',5.5,0.6,'2004-2026','seed'],
  ['alberto-nunez-feijoo','honesty',5.8,0.6,'2004-2026','seed'],
  ['alberto-nunez-feijoo','promises_kept',5.0,0.5,'2004-2026','seed'],
  ['santiago-abascal','composite',3.5,0.5,'2004-2026','seed'],
  ['santiago-abascal','honesty',3.2,0.6,'2004-2026','seed'],
  ['santiago-abascal','promises_kept',3.0,0.4,'2004-2026','seed'],
  ['yolanda-diaz','composite',6.0,0.5,'2004-2026','seed'],
  ['yolanda-diaz','honesty',6.5,0.5,'2004-2026','seed'],
  ['yolanda-diaz','promises_kept',5.0,0.4,'2004-2026','seed'],
  ['pablo-iglesias','composite',4.5,0.5,'2004-2026','seed'],
  ['pablo-iglesias','honesty',4.8,0.5,'2004-2026','seed'],
  ['pablo-iglesias','promises_kept',3.5,0.5,'2004-2026','seed'],
  ['isabel-diaz-ayuso','composite',4.8,0.5,'2004-2026','seed'],
  ['isabel-diaz-ayuso','honesty',4.5,0.5,'2004-2026','seed'],
  ['isabel-diaz-ayuso','promises_kept',5.5,0.4,'2004-2026','seed'],
  ['carles-puigdemont','composite',3.2,0.4,'2004-2026','seed'],
  ['carles-puigdemont','honesty',3.5,0.4,'2004-2026','seed'],
  ['carles-puigdemont','promises_kept',2.0,0.5,'2004-2026','seed'],
  ['salvador-illa','composite',5.8,0.6,'2004-2026','seed'],
  ['salvador-illa','honesty',6.2,0.6,'2004-2026','seed'],
  ['salvador-illa','promises_kept',5.5,0.5,'2004-2026','seed'],
]

for (const s of scoreData) {
  insertScore.run(...s)
}
console.log('[MIGRATE-V2] Seeded ' + scoreData.length + ' scores')

console.log('[MIGRATE-V2] Migration complete!')
db.close()