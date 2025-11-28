// api/syncAllPlaces.js
import { listPhotosByPrefix } from '../yandexStorage.js'

const PARSER_ENDPOINT = process.env.PARSER_ENDPOINT || ''
const MINIAPP_PLACES = process.env.MINIAPP_PLACES // URL мини-аппа

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

async function fetchPlaces(city) {
  const url = `${MINIAPP_PLACES}?city=${encodeURIComponent(city)}`
  const res = await fetch(url)
  const data = await res.json()
  return data.places || []
}

async function syncPlace(cityKey, place, limit) {
  const placeId = place.id
  const title = place.title || placeId

  const prefix = `${cityKey}/places/${placeId}/`
  const existing = await listPhotosByPrefix(prefix)

  const before = existing.length
  if (before >= limit) {
    return { placeId, title, before, after: before, added: 0, status: 'cached' }
  }

  const need = Math.max(limit - before, 1)

  if (!PARSER_ENDPOINT) {
    return { placeId, title, before, after: before, added: 0, status: 'no_parser' }
  }

  const base = PARSER_ENDPOINT.replace(/\/parse\/?$/, '')
  const endpoint = `${base}/parse-places`

  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: cityKey,
      limit: need,
      places: [{ id: placeId, title }]
    })
  })

  const updated = await listPhotosByPrefix(prefix)
  const after = updated.length

  return {
    placeId,
    title,
    before,
    after,
    added: Math.max(after - before, 0),
    status: after >= limit ? 'ok' : 'partial'
  }
}

export default async function handler(req, res) {
  setCors(res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  try {
    const { city = 'калининград', limit: l = '5' } = req.query
    const limit = Number(l) || 5

    if (!MINIAPP_PLACES) {
      return res.status(500).json({ error: 'MINIAPP_PLACES_not_set' })
    }

    const cityKey = city.toLowerCase()
    const places = await fetchPlaces(cityKey)

    const results = []
    for (const place of places) {
      const r = await syncPlace(cityKey, place, limit)
      results.push(r)
    }

    return res.status(200).json({
      status: 'done',
      city: cityKey,
      limit,
      count: results.length,
      results
    })
  } catch (e) {
    console.error('[syncAllPlaces] err', e)
    res.status(500).json({ error: e.message })
  }
}
