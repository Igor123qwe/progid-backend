// api/debugParser.js

export default function handler(req, res) {
  res.status(200).json({
    PARSER_ENDPOINT: process.env.PARSER_ENDPOINT || null,
    NODE_ENV: process.env.NODE_ENV || null,
  })
}
