// yandexImagesParser.js
// Тот же парсер Яндекс.Картинок, что у тебя на ПК,
// адаптированный под Vercel (serverless) через puppeteer-core + chrome-aws-lambda.

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

/**
 * Запуск браузера:
 *  - локально: обычный Chrome, как в твоём исходнике
 *  - на Vercel: специальный Chromium из chrome-aws-lambda
 */
async function launchBrowser() {
  if (process.env.VERCEL) {
    // Vercel / AWS Lambda окружение
    const executablePath = await chromium.executablePath() // <-- ВАЖНО: вызываем как функцию!
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless
    })
  }

  // Локальный запуск (как было у тебя)
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
}

/**
 * Получаем ссылки с Яндекс.Картинок
 */
async function getImages(query, limit = 5) {
  const browser = await launchBrowser()

  try {
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
    await browser.close()
  }
}

/**
 * Скачивает одну картинку по URL в указанный путь
 */
async function downloadImage(url, filepath) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Ошибка скачивания ${url}: ${res.status}`)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  await fs.promises.writeFile(filepath, buffer)
}

/**
 * Основная функция парсера:
 *  - routeId / pointIndex — какая точка маршрута
 *  - city / pointTitle   — текст для поиска
 *  - limit               — сколько картинок вытаскиваем
 */
export async function runParser({
  routeId,
  pointIndex,
  city,
  pointTitle,
  limit = 5
}) {
  const query = `${city || ''} ${pointTitle || ''}`.trim()

  console.log('[parser] Старт парсинга Yandex', {
    routeId,
    pointIndex,
    query
  })

  if (!query) {
    console.warn('[parser] Пустой query, парсинг пропущен')
    return
  }

  // 1. Берём ссылки из Яндекс.Картинок
  const urls = await getImages(query, limit)
  console.log('[parser] Найдено ссылок:', urls.length)

  if (!urls.length) return

  // 2. Скачиваем картинки во временную директорию (/tmp на Vercel)
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

  // 3. Сохраняем ссылки в БД
  if (uploadedUrls.length > 0) {
    savePhotos(routeId, pointIndex, uploadedUrls)
    console.log(
      `[parser] Сохранено ${uploadedUrls.length} URL в БД для routeId=${routeId}, pointIndex=${pointIndex}`
    )
  } else {
    console.log('[parser] Ни одной картинки не удалось загрузить')
  }
}
