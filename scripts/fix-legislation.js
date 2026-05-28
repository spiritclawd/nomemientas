#!/usr/bin/env node
// Fix legislation: recreate table without UNIQUE boe_id
const Database = require('better-sqlite3')
const path = require('path')
const db = new Database(path.join(__dirname, '..', 'db', 'nomemientas.db'))

// Save existing laws
const oldLaws = db.prepare('SELECT * FROM legislation').all()
console.log('Existing laws: ' + oldLaws.length)

// Drop and recreate
db.exec('DROP TABLE IF EXISTS legislation_replacement')
db.exec(`CREATE TABLE legislation_replacement (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boe_id TEXT DEFAULT NULL,
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
)`)

const ins = db.prepare('INSERT INTO legislation_replacement (title, type, date_published, summary, category, governing_party, topics) VALUES (?, ?, ?, ?, ?, ?, ?)')

// Insert all laws (no UNIQUE boe_id)
const laws = [
  ['Ley 3/2020 de Educacion (LOMLOE)', 'ley', '2020-12-29', 'Nueva ley educativa que derogo la LOMCE.', 'educacion', 'PSOE', '["educacion"]'],
  ['Ley 2/2021 de Memoria Democratica', 'ley', '2021-10-11', 'Ley de memoria sobre el franquismo.', 'memoria', 'PSOE', '["memoria"]'],
  ['Real Decreto-ley 32/2021 de Reforma Laboral', 'ley', '2021-12-28', 'Reforma laboral que derogo elementos de la reforma de 2012.', 'trabajo', 'PSOE', '["trabajo"]'],
  ['Ley 4/2023 de Paridad', 'ley', '2023-02-28', 'Ley de representacion paritaria.', 'igualdad', 'PSOE', '["igualdad"]'],
  ['Ley Organica 2/2024 de Amnistia', 'ley', '2024-06-11', 'Ley de amnistia para la normalizacion en Catalunya.', 'justicia', 'PSOE', '["amnistia"]'],
  ['Ley 3/2012 de reforma laboral', 'ley', '2012-07-06', 'Reforma laboral del gobierno de Rajoy.', 'trabajo', 'PP', '["trabajo"]'],
  ['Ley Organica 8/2013 (LOMCE)', 'ley', '2013-12-09', 'Reforma educativa del PP.', 'educacion', 'PP', '["educacion"]'],
  ['Ley 19/2013 de transparencia', 'ley', '2013-12-09', 'Ley de transparencia y buen gobierno.', 'transparencia', 'PP', '["transparencia"]'],
  ['Ley 1/2021 de Cambio Climatico', 'ley', '2021-05-20', 'Ley de cambio climatico y transicion energetica.', 'medioambiente', 'PSOE', '["clima"]'],
  ['Ley 15/2022 de Igualdad de Trato', 'ley', '2022-07-12', 'Ley integral para la igualdad de trato.', 'igualdad', 'PSOE', '["igualdad"]'],
  ['Ley Organica 2/2015 de Seguridad Ciudadana', 'ley', '2015-03-30', 'Ley de proteccion de la seguridad ciudadana.', 'justicia', 'PP', '["seguridad"]'],
  ['Ley 19/2013 de Transparencia', 'ley', '2013-12-09', 'Ley de transparencia, acceso a la informacion.', 'transparencia', 'PP', '["transparencia"]'],
]
for (const l of laws) ins.run(...l)
console.log('Inserted ' + laws.length + ' laws')

// Swap tables
db.exec('DROP TABLE legislation')
db.exec('ALTER TABLE legislation_replacement RENAME TO legislation')
db.exec('CREATE INDEX IF NOT EXISTS idx_legislation_date ON legislation(date_published)')

const total = db.prepare('SELECT COUNT(*) as t FROM legislation').get().t
console.log('Legislation count: ' + total)
db.close()