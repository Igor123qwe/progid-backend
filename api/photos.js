// api/photos.js

import { listPhotosByPrefix } from '../yandexStorage.js'

const PARSER_ENDPOINT = process.env.PARSER_ENDPOINT || '' // URL до парсера, заканчивается на /parse

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// приведение к массиву строк-URL
function normalizePhotoUrls(raw) {
  if (!raw) return []

  if (Array.isArray(raw)) {
    return raw
      .map(item => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          return item.publicUrl || item.url || item.href || null
        }
        return null
      })
      .filter((u) => typeof u === 'string')
  }

  return []
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
    console.log('[photos] prefix =', prefix)

    // 1. Пробуем найти фото в облаке
    let rawPhotos = (await listPhotosByPrefix(prefix)) || []
    let photos = normalizePhotoUrls(rawPhotos)

    if (photos.length > 0) {
      return res.status(200).json({
        status: 'done',
        photos,
      })
    }

    // 2. Фото нет — дергаем парсер, если указан PARSER_ENDPOINT
    if (PARSER_ENDPOINT) {
      try {
        console.log('[photos] call parser', {
          routeId,
          pointIdx,
          city,
          title,
        })

        const response = await fetch(PARSER_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeId,
            pointIndex: pointIdx, // число
            city,                 // отправляем нормальный город, парсер сам сделает cityKey
            title,
            limit: 5,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log('[photos] parser response:', data)

          // Если парсер уже вернул готовые URL — нормализуем и отдаём
          const parserPhotos = normalizePhotoUrls(data.photos)
          if (parserPhotos.length > 0) {
            return res.status(200).json({
              status: 'done',
              photos: parserPhotos,
            })
          }
        } else {
          console.error('[photos] Парсер вернул статус', response.status)
        }
      } catch (e) {
        console.error('[photos] Ошибка запроса к парсеру', e)
      }
    } else {
      console.warn('[photos] PARSER_ENDPOINT не задан — парсер не дергаем')
    }

    // 3. После парсера ещё раз глянем в бакет —
    //    вдруг он успел хоть что-то залить
    rawPhotos = (await listPhotosByPrefix(prefix)) || []
    photos = normalizePhotoUrls(rawPhotos)

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
