// Admin panel API (requires role=admin):
// GET  /api/admin -> { users: [...], codes: [...] }
// POST /api/admin { action: 'setTier'|'addCode'|'delCode'|'resetState', ... }
import { sessionUser, saveUsers, isAdmin, TIER_RANK } from './_lib/auth.js'
import { saveState, defaultState } from './_lib/state.js'
import { authorized, json } from './_lib/http.js'

export default async function handler(req, res) {
  try {
    // Portfolio reset can also be triggered with the CRON_SECRET scheme
    // (Authorization: Bearer <secret>, or ?token=), so it doesn't depend on a
    // browser admin session. Same effect as the admin-panel button below.
    if (req.method === 'POST' && req.body?.action === 'resetState' && authorized(req)) {
      await saveState(defaultState())
      return json(res, 200, { ok: true, reset: true, via: 'cron-secret' })
    }

    const sess = await sessionUser(req)
    if (!sess || !isAdmin(sess.user)) return json(res, 403, { error: 'admin only' })
    const db = sess.db

    if (req.method === 'GET') {
      const users = Object.entries(db.users).map(([username, u]) => ({
        username,
        email: u.email || username,
        emailVerified: !!u.emailVerified,
        tier: u.tier || 'free',
        role: u.role || 'user',
        createdAt: u.createdAt,
      }))
      users.sort((a, b) => b.createdAt - a.createdAt)
      const codes = Object.entries(db.codes).map(([code, c]) => ({
        code,
        tier: c.tier || 'premium',
        uses: c.uses || 0,
        createdAt: c.createdAt,
      }))
      codes.sort((a, b) => b.createdAt - a.createdAt)
      return json(res, 200, { users, codes })
    }

    const { action, username, tier, code } = req.body || {}

    if (action === 'setTier') {
      const key = String(username || '').toLowerCase()
      if (!db.users[key]) return json(res, 404, { error: 'no such user' })
      if (!(tier in TIER_RANK)) return json(res, 400, { error: 'bad tier' })
      db.users[key].tier = tier
      await saveUsers(db)
      return json(res, 200, { ok: true })
    }

    if (action === 'addCode') {
      const c = String(code || '').trim()
      if (!/^\d{4}$/.test(c)) return json(res, 400, { error: 'Codes are 4 digits' })
      if (db.codes[c]) return json(res, 409, { error: 'Code already exists' })
      if (!(tier in TIER_RANK) || tier === 'free') return json(res, 400, { error: 'bad tier' })
      db.codes[c] = { tier, uses: 0, createdAt: Date.now() }
      await saveUsers(db)
      return json(res, 200, { ok: true })
    }

    if (action === 'delCode') {
      delete db.codes[String(code || '').trim()]
      await saveUsers(db)
      return json(res, 200, { ok: true })
    }

    // Wipe the portfolio/board state back to a fresh start: START_CASH in cash,
    // no positions, orders, chats, series, cooldowns, or daily budgets. Users,
    // tiers, and codes are untouched (those live in a separate key).
    if (action === 'resetState') {
      await saveState(defaultState())
      return json(res, 200, { ok: true, reset: true })
    }

    return json(res, 400, { error: 'unknown action' })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
