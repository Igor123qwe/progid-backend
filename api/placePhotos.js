// api/placePhotos.js

import { listPhotosByPrefix } from '../yandexStorage.js'

const PARSER_ENDPOINT = process.env.PARSER_ENDPOINT || '' // как и для /api/photos

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
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    const {
      city = '',
      placeId = '',
      title = '',
      limit: limitRaw = '5',
    } = req.query

    const limit = Number(limitRaw) || 5

    if (!city || !placeId) {
      return res.status(400).json({
        error: 'city_and_placeId_required',
      })
    }

    const cityKey = (city || '').trim().toLowerCase()
    const prefix = `${cityKey}/places/${placeId}/`

    // 1. Пытаемся найти уже загруженные фотки
    const existing = await listPhotosByPrefix(prefix)

    if (existing && existing.length) {
      return res.status(200).json({
        status: 'done',
        photos: existing,
      })
    }

    // 2. Фоток ещё нет — триггерим парсер (parse-places) и отвечаем pending
    if (!PARSER_ENDPOINT) {
      // парсер не настроен — просто говорим, что пока нет фоток
      return res.status(200).json({
        status: 'pending',
        photos: [],
      })
    }

    const endpoint = PARSER_ENDPOINT.replace(
      /\/parse\/?$/,
      '/parse-places'
    )

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city,
          limit,
          places: [
            {
              id: placeId,
              title: title || placeId,
            },
          ],
        }),
      })
    } catch (e) {
      console.error('[vercel] Ошибка вызова parse-places', e)
      // не валим ответ — просто скажем, что фоток пока нет
    }

    return res.status(200).json({
      status: 'pending',
      photos: [],
    })
  } catch (e) {
    console.error('[vercel] Ошибка /api/placePhotos', e)
    return res.status(500).json({
      error: 'internal_error',
      message: e.message,
    })
  }
}
