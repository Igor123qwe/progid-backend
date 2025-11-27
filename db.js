 db.js
import Database from 'better-sqlite3'

const db = new Database('data.sqlite')

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

export function getPhotos(routeId, pointIndex) {
  const stmt = db.prepare(
    'SELECT url FROM photos WHERE routeId =  AND pointIndex =  ORDER BY id ASC'
  )
  const rows = stmt.all(routeId, pointIndex)
  return rows.map(r = r.url)
}

export function savePhotos(routeId, pointIndex, urls) {
  if (!urls  urls.length === 0) return
  const insert = db.prepare(
    'INSERT INTO photos (routeId, pointIndex, url) VALUES (, , )'
  )

  const tx = db.transaction(urlsArr = {
    for (const url of urlsArr) {
      insert.run(routeId, pointIndex, url)
    }
  })

  tx(urls)
}
