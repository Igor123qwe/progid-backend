// index.js — entrypoint для Node.js Express Runtime на Vercel
// У тебя "type": "module", поэтому используем import

import express from 'express';

const app = express();

app.use(express.json());

// базовый маршрут — чтобы мини-приложение могло проверить, жив ли бэкенд
app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'ProGid backend is running',
  });
});

// пример доп. маршрута
app.get('/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// 🎯 КЛЮЧЕВОЕ: для Vercel нужно экспортировать app, НЕ вызывать app.listen()
export default app;
