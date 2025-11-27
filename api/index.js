// api/index.js
// Главный endpoint: GET /api

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    ok: true,
    message: 'Progid backend is running (serverless /api)',
  });
}
