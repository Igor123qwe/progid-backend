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
    res.setHeader('Allow', 'GET,OPTIONS')
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
    let existing = (await listPhotosByPrefix(prefix)) || []

    // 👉 если уже хватает фоток (не меньше limit) — просто отдаём
    if (existing.length >= limit) {
      return res.status(200).json({
        status: 'done',
        photos: existing.slice(0, limit),
      })
    }

    // 2. Фоток меньше, чем нужно — триггерим парсер (parse-places)
    if (PARSER_ENDPOINT) {
      // сколько ещё нужно фоток, минимум 1
      const need = Math.max(limit - existing.length, 1)

      // PARSER_ENDPOINT ожидаем вида .../parse
      const base = PARSER_ENDPOINT.replace(/\/parse\/?$/, '')
      const endpoint = `${base}/parse-places`

      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            city,
            // передаём только недостающее кол-во
            limit: need,
            places: [
              {
                id: placeId,
                title: title || placeId,
              },
            ],
          }),
        })
      } catch (e) {
        console.error('[placePhotos] Ошибка вызова parse-places', e)
        // не валим ответ — просто скажем, что фоток пока нет / не хватает
      }
    } else {
      console.warn(
        '[placePhotos] PARSER_ENDPOINT не задан — парсер по places не дергаем'
      )
    }

    // 3. после вызова парсера ещё раз проверим бакет —
    //    вдруг уже успели залиться фотки
    existing = (await listPhotosByPrefix(prefix)) || []

    if (existing.length) {
      return res.status(200).json({
        status: existing.length >= limit ? 'done' : 'partial',
        photos: existing.slice(0, limit),
      })
    }

    // вообще ничего нет — ждём, пока парсер когда-нибудь докачает
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
