// api/photos.js
import { getPhotos } from '../db.js'
import { runParser } from '../yandexImagesParser.js'

const runningTasks = new Set()

export default async function handler(req, res) {
  // Разрешаем только GET
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

    // 1. Пытаемся достать фото из БД
    const photos = await getPhotos(routeId, pointIdx)

    if (photos.length > 0) {
      return res.status(200).json({
        status: 'done',
        photos,
      })
    }

    // 2. Если фото нет — лениво запускаем парсер
    const taskKey = `${routeId}_${pointIdx}`

    if (!runningTasks.has(taskKey)) {
      runningTasks.add(taskKey)

      // запуск парсера в фоне — не ждём его
      runParser({
        routeId,
        pointIndex: pointIdx,
        city,
        pointTitle: title,
      })
        .catch(err => {
          console.error('[vercel] Ошибка парсера для', taskKey, err)
        })
        .finally(() => {
          runningTasks.delete(taskKey)
        })
    }

    // 3. Сообщаем фронту, что парсер запущен
    return res.status(200).json({
      status: 'pending',
      photos: [],
    })
  } catch (e) {
    console.error('[vercel] Ошибка /api/photos', e)
    return res.status(500).json({ error: 'internal_error' })
  }
}
