// POST /api/auth { action: 'register'|'login'|'logout'|'code', ... }
// GET  /api/auth -> current user (Bearer token)
import {
  loadUsers,
  saveUsers,
  hashPassword,
  verifyPassword,
  validUsername,
  createSession,
  destroySession,
  sessionUser,
  publicUser,
  adminUsername,
  TIER_RANK,
} from './_lib/auth.js'
import { json } from './_lib/http.js'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const sess = await sessionUser(req)
      if (!sess) return json(res, 200, { user: null })
      return json(res, 200, { user: publicUser(sess.username, sess.user) })
    }

    const { action, username, password, code } = req.body || {}

    if (action === 'register') {
      if (!validUsername(username)) return json(res, 400, { error: 'Username: 3-20 letters, numbers or _' })
      if (typeof password !== 'string' || password.length < 6)
        return json(res, 400, { error: 'Password must be at least 6 characters' })
      const db = await loadUsers()
      const key = username.toLowerCase()
      if (db.users[key]) return json(res, 409, { error: 'Username already taken' })
      db.users[key] = {
        name: username,
        pass: hashPassword(password),
        tier: 'free',
        role: key === adminUsername() ? 'admin' : 'user',
        createdAt: Date.now(),
      }
      await saveUsers(db)
      const token = await createSession(key)
      return json(res, 200, { token, user: publicUser(key, db.users[key]) })
    }

    if (action === 'login') {
      const db = await loadUsers()
      const key = String(username || '').toLowerCase()
      const user = db.users[key]
      if (!user || !verifyPassword(password || '', user.pass)) {
        return json(res, 401, { error: 'Wrong username or password' })
      }
      // Bootstrap/refresh admin role from env.
      if (key === adminUsername() && user.role !== 'admin') {
        user.role = 'admin'
        await saveUsers(db)
      }
      const token = await createSession(key)
      return json(res, 200, { token, user: publicUser(key, user) })
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
