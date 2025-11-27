// api/photos.js

import { getPhotos } from '../db.js'
import { runParser } from '../yandexImagesParser.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
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

    // 1. Пробуем достать фото из БД
    let photos = await getPhotos(routeId, pointIdx)

    if (Array.isArray(photos) && photos.length > 0) {
      return res.status(200).json({
        status: 'done',
        photos,
      })
    }

    // 2. Если нет — запускаем парсер и ЖДЁМ
    await runParser({
      routeId,
      pointIndex: pointIdx,
      city,
      pointTitle: title,
    })

    // 3. Ещё раз читаем из БД
    photos = await getPhotos(routeId, pointIdx)

    if (Array.isArray(photos) && photos.length > 0) {
      return res.status(200).json({
        status: 'done',
        photos,
      })
    }

    // 4. Парсер ничего не нашёл / не сохранил
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
