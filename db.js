// db.js
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Выбираем директорию для БД
// - на Vercel пишем в /tmp/progid
// - локально можно тоже в /tmp/progid, это норм
const baseDir =
  process.env.DB_DIR ||
  path.join(os.tmpdir(), 'progid') // пример: /tmp/progid

if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true })
}

const dbPath = path.join(baseDir, 'photos.sqlite')
console.log('[db] Используем файл БД:', dbPath)

// Открываем БД
const db = new Database(dbPath)

// создаём таблицу и индекс, если их нет
db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routeId TEXT NOT NULL,
    pointIndex INTEGER NOT NULL,
    url TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_photos_route_point
    ON photos (routeId, pointIndex);
`)

// получить список url по маршруту и точке
export function getPhotos(routeId, pointIndex) {
  const stmt = db.prepare(
    'SELECT url FROM photos WHERE routeId = ? AND pointIndex = ? ORDER BY id ASC'
  )
  const rows = stmt.all(routeId, pointIndex)
  return rows.map((r) => r.url)
}

// сохранить массив url в БД
export function savePhotos(routeId, pointIndex, urls) {
  if (!urls || urls.length === 0) return

  const insert = db.prepare(
    'INSERT INTO photos (routeId, pointIndex, url) VALUES (?, ?, ?)'
  )

  const tx = db.transaction((urlsArr) => {
    for (const url of urlsArr) {
      insert.run(routeId, pointIndex, url)
    }
  })

  tx(urls)
}
