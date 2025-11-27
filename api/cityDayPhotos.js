// api/cityDayPhotos.js

import { listPhotosByPrefix, cityToSlug } from '../yandexStorage.js'

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  setCors(res)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET,OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { city = '', day = '1' } = req.query
    if (!city) {
      return res.status(400).json({ error: 'city обязателен' })
    }

    const dayNum = Number(day) || 1
    const cityKey = (city || '').trim().toLowerCase()
    const slug = cityToSlug(cityKey)            // kaliningrad, kazan, moscow...

    // путь: <город_кириллица>/<slug>_day_<N>/
    const prefix = `${cityKey}/${slug}_day_${dayNum}/`

    const photos = await listPhotosByPrefix(prefix)

    return res.status(200).json({
      status: photos.length ? 'done' : 'empty',
      photos,
    })
  } catch (e) {
    console.error('[cityDayPhotos] error', e)
    return res.status(500).json({
      error: 'internal_error',
      message: e.message,
    })
  }
}
