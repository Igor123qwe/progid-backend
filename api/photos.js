// api/photos.js

// ⚠ НИЧЕГО не импортируем статически, чтобы не падать на этапе загрузки модуля

const runningTasks = new Set();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { routeId, pointIndex, city = '', title = '' } = req.query;
    const pointIdx = Number(pointIndex);

    if (!routeId || Number.isNaN(pointIdx)) {
      return res.status(400).json({
        error: 'routeId и pointIndex обязательны',
      });
    }

    // 🔥 ДИНАМИЧЕСКИЕ ИМПОРТЫ — не упадём, даже если файлы CJS
    const dbModule = await import('../db.js');
    const parserModule = await import('../yandexImagesParser.js');

    // Поддерживаем и ESM-экспорт, и CommonJS (module.exports = {...})
    const db = dbModule.default ?? dbModule;
    const parser = parserModule.default ?? parserModule;

    const getPhotos = db.getPhotos;
    const runParser = parser.runParser;

    if (typeof getPhotos !== 'function') {
      throw new Error('getPhotos is not a function (проверь экспорт в db.js)');
    }
    if (typeof runParser !== 'function') {
      throw new Error('runParser is not a function (проверь экспорт в yandexImagesParser.js)');
    }

    // 1. Пытаемся достать фото из БД
    const photos = await getPhotos(routeId, pointIdx);

    if (Array.isArray(photos) && photos.length > 0) {
      return res.status(200).json({
        status: 'done',
        photos,
      });
    }

    // 2. Если фото нет — лениво запускаем парсер
    const taskKey = `${routeId}_${pointIdx}`;

    if (!runningTasks.has(taskKey)) {
      runningTasks.add(taskKey);

      // запуск парсера в фоне — не ждём его завершения
      runParser({
        routeId,
        pointIndex: pointIdx,
        city,
        pointTitle: title,
      })
        .catch((err) => {
          console.error('[vercel] Ошибка парсера для', taskKey, err);
        })
        .finally(() => {
          runningTasks.delete(taskKey);
        });
    }

    // 3. Сообщаем фронту, что парсер запущен
    return res.status(200).json({
      status: 'pending',
      photos: [],
    });
  } catch (e) {
    console.error('[vercel] Ошибка /api/photos', e);
    // временно отдадим текст ошибки наружу, чтобы было удобнее дебажить
    return res.status(500).json({
      error: 'internal_error',
      message: e.message,
    });
  }
}
