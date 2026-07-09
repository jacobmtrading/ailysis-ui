export function authorized(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token = req.query?.token || (req.headers?.authorization || '').replace(/^Bearer /, '')
  return token === secret
}

export function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}
