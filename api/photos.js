// api/photos.js

import { listPhotosByPrefix } from '../yandexStorage.js'

const PARSER_ENDPOINT = process.env.PARSER_ENDPOINT || '' // URL до парсера, заканчивается на /parse

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  // --- CORS для всех запросов ---
  setCors(res)

  // preflight-запрос браузера
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET,OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { routeId, pointIndex, city = '', title = '' } = req.query
    const pointIdx = Number(pointIndex)

    if (!routeId || Number.isNaN(pointIdx)) {
      return res.status(400).json({
        error: 'routeId и pointIndex обязательны',
      })
    }

    // ключ города так же, как в бакете
    const cityKey = (city || '').trim().toLowerCase()

    // путь в бакете: <город>/<routeId>/point_<index>/
    const prefix = `${cityKey}/${routeId}/point_${pointIdx}/`

    // 1. Пробуем найти фото в облаке
    let photos = await listPhotosByPrefix(prefix)

    if (photos.length > 0) {
      return res.status(200).json({
        status: 'done',
        photos,
      })
    }

    // 2. Фото нет — дергаем парсер, если указан PARSER_ENDPOINT
    if (PARSER_ENDPOINT) {
      try {
        const response = await fetch(PARSER_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeId,
            pointIndex: pointIdx, // число
            city: cityKey,        // тот же ключ, что и в бакете
            title,
            limit: 5,
          }),
        })

        if (response.ok) {
          const data = await response.json()

          // Если парсер уже вернул готовые URL — сразу отдаем
          if (Array.isArray(data.photos) && data.photos.length > 0) {
            return res.status(200).json({
              status: 'done',
              photos: data.photos,
            })
          }
        } else {
          console.error('[photos] Парсер вернул статус', response.status)
        }
      } catch (e) {
        console.error('[photos] Ошибка запроса к парсеру', e)
      }
    }

    // 3. Даже если парсер не ответил/упал, ещё раз глянем в бакет —
    //    вдруг он успел хоть что-то залить
    photos = await listPhotosByPrefix(prefix)

    if (photos.length > 0) {
      return res.status(200).json({
        status: 'done',
        photos,
      })
    }

    // Пока фоток нет
    return res.status(200).json({
      status: 'pending',
      photos: [],
    })
  } catch (e) {
    console.error('[vercel] Ошибка /api/photos', e)
    return res.status(500).json({
      error: 'internal_error',
      message: e.message,
    })
  }
}
