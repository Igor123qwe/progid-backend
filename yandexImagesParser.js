// yandexImagesParser.js

import chromium from '@sparticuz/chrome-aws-lambda'
import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { uploadFile, cityToSlug } from './yandexStorage.js'
import { savePhotos } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------

async function getImages(query, limit = 5) {
  let browser

  try {
    // На Vercel (serverless) используем chrome-aws-lambda
    if (process.env.VERCEL) {
      const executablePath = await chromium.executablePath

      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: chromium.headless,
      })
    } else {
      // Локальный запуск на твоём ПК
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    }

    const page = await browser.newPage()

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    const url =
      'https://yandex.ru/images/search?text=' + encodeURIComponent(query)

    await page.goto(url, { waitUntil: 'networkidle2' })
    await page.waitForSelector('img', { timeout: 15000 })

    const urls = await page.$$eval(
      'img',
      (imgs, limitInner) => {
        const result = []

        for (const img of imgs) {
          let src =
            img.src ||
            img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            img.getAttribute('data-lqip-src')

          if (!src) continue
          if (src.startsWith('//')) src = 'https:' + src
          if (!src.startsWith('http')) continue

          // отфильтруем сторонний мусор, оставим только яндексовые CDN
          if (
            !/yandex\.net|yastatic\.net|avatars\.mds\.yandex\.net/i.test(src)
          ) {
            continue
          }

          result.push(src)
          if (result.length >= limitInner) break
        }

        return result
      },
      limit
    )

    return urls
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

async function downloadImage(url, filepath) {
  // В Node 20 fetch глобальный – node-fetch не нужен
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`Ошибка скачивания ${url}: ${res.status}`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  await fs.promises.writeFile(filepath, buffer)
}

// ---------- ОСНОВНАЯ ФУНКЦИЯ ПАРСЕРА ----------

/**
 * Запуск парсера:
 *  - routeId / pointIndex — какая точка маршрута
 *  - city / pointTitle   — текст для поиска
 *  - limit               — сколько картинок вытаскиваем
 */
export async function runParser({
  routeId,
  pointIndex,
  city,
  pointTitle,
  limit = 5,
}) {
  const query = `${city || ''} ${pointTitle || ''}`.trim()

  console.log('[parser] Старт парсинга', {
    routeId,
    pointIndex,
    query,
  })

  if (!query) {
    console.warn('[parser] Пустой query, парсинг пропущен')
    return
  }

  // 1. Парсим ссылки из Яндекс.Картинок
  const urls = await getImages(query, limit)
  console.log('[parser] Найдено ссылок:', urls.length)

  if (!urls.length) return

  // 2. Скачиваем во временную директорию (на Vercel пишем в /tmp)
  const tmpBase = os.tmpdir()
  const tmpDir = path.join(
    tmpBase,
    'progid-images',
    String(routeId),
    String(pointIndex)
  )

  await fs.promises.mkdir(tmpDir, { recursive: true })

  const uploadedUrls = []
  let i = 0

  for (const imgUrl of urls) {
    i++
    const filename = `image-${i}.jpg`
    const localPath = path.join(tmpDir, filename)

    try {
      console.log('[parser] Скачиваем', imgUrl)
      await downloadImage(imgUrl, localPath)

      const key = `${cityToSlug(city)}/route_${routeId}/point_${pointIndex}/${filename}`

      const publicUrl = await uploadFile(localPath, key)
      console.log('[parser] Загружено в хранилище', publicUrl)

      uploadedUrls.push(publicUrl)
    } catch (e) {
      console.error('[parser] Ошибка при обработке', imgUrl, e)
    }
  }

  // 3. Сохраняем ссылки в БД (SQLite в /tmp)
  if (uploadedUrls.length > 0) {
    savePhotos(routeId, pointIndex, uploadedUrls)
    console.log(
      `[parser] Сохранено ${uploadedUrls.length} URL в БД для routeId=${routeId}, pointIndex=${pointIndex}`
    )
  } else {
    console.log('[parser] Ни одной картинки не удалось загрузить')
  }
}
