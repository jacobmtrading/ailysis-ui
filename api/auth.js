// POST /api/auth { action: 'register'|'login'|'logout'|'code', ... }
// GET  /api/auth -> current user (Bearer token)
import {
  loadUsers,
  saveUsers,
  hashPassword,
  verifyPassword,
  validEmail,
  nameFromEmail,
  createSession,
  destroySession,
  createVerifyToken,
  sessionUser,
  publicUser,
  adminEmail,
  TIER_RANK,
} from './_lib/auth.js'
import { sendVerificationEmail } from './_lib/mail.js'
import { json } from './_lib/http.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const sess = await sessionUser(req)
      if (!sess) return json(res, 200, { user: null })
      return json(res, 200, { user: publicUser(sess.username, sess.user) })
    }

    const { action, email, password, code } = req.body || {}

    if (action === 'register') {
      if (!validEmail(email)) return json(res, 400, { error: 'Enter a valid email address' })
      if (typeof password !== 'string' || password.length < 6)
        return json(res, 400, { error: 'Password must be at least 6 characters' })
      const db = await loadUsers()
      const key = email.trim().toLowerCase()
      if (db.users[key]) return json(res, 409, { error: 'An account with this email already exists' })
      db.users[key] = {
        email: key,
        name: nameFromEmail(key),
        pass: hashPassword(password),
        tier: 'free',
        role: key === adminEmail() ? 'admin' : 'user',
        emailVerified: false,
        createdAt: Date.now(),
      }
      await saveUsers(db)
      // Fire off the confirmation email; don't fail signup if mail is flaky.
      try {
        const vtoken = await createVerifyToken(key)
        await sendVerificationEmail(key, vtoken)
      } catch (e) {
        console.error('verification email failed:', e.message)
      }
      const token = await createSession(key)
      return json(res, 200, { token, user: publicUser(key, db.users[key]) })
    }

    if (action === 'login') {
      const db = await loadUsers()
      const key = String(email || '').trim().toLowerCase()
      const user = db.users[key]
      if (!user || !verifyPassword(password || '', user.pass)) {
        return json(res, 401, { error: 'Wrong email or password' })
      }
      // Bootstrap/refresh admin role from env.
      if (key === adminEmail() && user.role !== 'admin') {
        user.role = 'admin'
        await saveUsers(db)
      }
      const token = await createSession(key)
      return json(res, 200, { token, user: publicUser(key, user) })
    }

    if (action === 'resend') {
      const sess = await sessionUser(req)
      if (!sess) return json(res, 401, { error: 'Log in first' })
      if (sess.user.emailVerified) return json(res, 200, { ok: true, alreadyVerified: true })
      try {
        const vtoken = await createVerifyToken(sess.username)
        await sendVerificationEmail(sess.username, vtoken)
      } catch (e) {
        return json(res, 502, { error: 'Could not send email right now — try again shortly' })
      }
      return json(res, 200, { ok: true })
    }

    if (action === 'logout') {
      const auth = req.headers?.authorization || ''
      await destroySession(auth.startsWith('Bearer ') ? auth.slice(7) : null)
      return json(res, 200, { ok: true })
    }

    if (action === 'code') {
      const sess = await sessionUser(req)
      if (!sess) return json(res, 401, { error: 'Log in first to redeem a code' })
      const c = String(code || '').trim()
      if (!/^\d{4}$/.test(c)) return json(res, 400, { error: 'Codes are 4 digits' })
      const entry = sess.db.codes[c]
      if (!entry) return json(res, 404, { error: 'Unknown code' })
      const target = entry.tier || 'premium'
      if (TIER_RANK[target] > TIER_RANK[sess.user.tier || 'free']) {
        sess.user.tier = target
      }
      entry.uses = (entry.uses || 0) + 1
      await saveUsers(sess.db)
      return json(res, 200, { ok: true, user: publicUser(sess.username, sess.user) })
    }

    return json(res, 400, { error: 'unknown action' })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
