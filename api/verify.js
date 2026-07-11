// GET /api/verify?token=... — confirms a user's email, then redirects back
// to the app with ?verified=1 (success) or ?verified=0 (bad/expired link).
import { loadUsers, saveUsers, consumeVerifyToken } from './_lib/auth.js'
import { appUrl } from './_lib/mail.js'

export default async function handler(req, res) {
  const base = appUrl()
  const fail = () => {
    res.statusCode = 302
    res.setHeader('Location', `${base}/?verified=0`)
    res.end()
  }
  try {
    const token = (req.query?.token || '').toString()
    const email = await consumeVerifyToken(token)
    if (!email) return fail()

    const db = await loadUsers()
    const key = String(email).toLowerCase()
    const user = db.users[key]
    if (!user) return fail()

    if (!user.emailVerified) {
      user.emailVerified = true
      user.verifiedAt = Date.now()
      await saveUsers(db)
    }
    res.statusCode = 302
    res.setHeader('Location', `${base}/?verified=1`)
    res.end()
  } catch (err) {
    fail()
  }
}
