export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    message: "Progid backend serverless is running"
  });
}
