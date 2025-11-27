// server.js
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
import { getPhotos } from './db.js'
import { runParser } from './yandexImagesParser.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(bodyParser.json())

const runningTasks = new Set()

/**
 * GET /api/photos
 * Параметры:
 *   routeId    - обязательный
 *   pointIndex - обязательный (число)
 *   city       - необязательно, но лучше передавать
 *   title      - название точки (Кафедральный собор и т.п.)
 *
 * Ответ:
 *  {
 *    status: "done" | "pending",
 *    photos: [ "https://...", ... ]
 *  }
 */
app.get('/api/photos', async (req, res) => {
  try {
    const routeId = String(req.query.routeId || '').trim()
    const pointIndexRaw = req.query.pointIndex
    const city = String(req.query.city || '').trim()
    const title = String(req.query.title || '').trim()

    const pointIndex = Number(pointIndexRaw)

    if (!routeId || Number.isNaN(pointIndex)) {
      return res.status(400).json({
        error: 'routeId и pointIndex обязательны',
      })
    }

    // 1. Сначала пробуем достать фото из БД
    const photos = await getPhotos(routeId, pointIndex)

    if (photos.length > 0) {
      return res.json({
        status: 'done',
        photos,
      })
    }

    // 2. Если фото нет — запускаем парсер в фоне (лениво)
    const taskKey = `${routeId}_${pointIndex}`
    if (!runningTasks.has(taskKey)) {
      runningTasks.add(taskKey)
      runParser({
        routeId,
        pointIndex,
        city,
        pointTitle: title,
      })
        .catch(err =>
          console.error('[server] Ошибка парсера для', taskKey, err)
        )
        .finally(() => {
          runningTasks.delete(taskKey)
        })
    }

    // Возвращаем pending — фронт может через 1–2 сек повторить запрос
    return res.json({
      status: 'pending',
      photos: [],
    })
  } catch (e) {
    console.error('[server] Ошибка /api/photos', e)
    res.status(500).json({ error: 'internal_error' })
  }
})

const port = process.env.PORT || 3005
app.listen(port, () => {
  console.log(`ProGid backend запущен на порту ${port}`)
})
