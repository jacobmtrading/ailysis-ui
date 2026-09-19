import { timingSafeEqual } from 'node:crypto'

export function authorized(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token = req.query?.token || (req.headers?.authorization || '').replace(/^Bearer /, '')
  const given = Buffer.from(String(token))
  const want = Buffer.from(secret)
  return given.length === want.length && timingSafeEqual(given, want)
}

export function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}
