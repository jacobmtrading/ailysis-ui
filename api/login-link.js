// GET /api/login-link?token=... — passwordless login. Consumes the one-time
// token, creates a session, marks the email verified (the click proves the
// user controls the inbox), then redirects to the app carrying the session
// token so the SPA can store it. The app strips the token from the URL on load.
import { loadUsers, saveUsers, consumeLoginToken, createSession } from './_lib/auth.js'
import { appUrl } from './_lib/mail.js'

export default async function handler(req, res) {
  const base = appUrl()
  const redirect = (loc) => {
    res.statusCode = 302
    res.setHeader('Location', loc)
    res.end()
  }
  try {
    const token = (req.query?.token || '').toString()
    const email = await consumeLoginToken(token)
    if (!email) return redirect(`${base}/?login=expired`)

    const db = await loadUsers()
    const key = String(email).toLowerCase()
    const user = db.users[key]
    if (!user) return redirect(`${base}/?login=expired`)

    if (!user.emailVerified) {
      user.emailVerified = true
      user.verifiedAt = Date.now()
      await saveUsers(db)
    }
    const session = await createSession(key)
    return redirect(`${base}/?token=${encodeURIComponent(session)}`)
  } catch (err) {
    redirect(`${base}/?login=expired`)
  }
}
