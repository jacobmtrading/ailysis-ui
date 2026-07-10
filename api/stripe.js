// Stripe subscriptions without the SDK (plain REST):
// POST /api/stripe { action: 'checkout', plan: 'premium'|'tailormade' } -> { url }
// POST /api/stripe { action: 'confirm', sessionId } -> upgrades tier if paid
// Cancellations/downgrades are handled manually in the admin panel (MVP).
import { sessionUser, saveUsers, TIER_RANK } from './_lib/auth.js'
import { json } from './_lib/http.js'

const PRICE_FOR = {
  premium: () => process.env.STRIPE_PRICE_PREMIUM,
  tailormade: () => process.env.STRIPE_PRICE_TAILORMADE,
}

async function stripe(path, params) {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)')
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`)
  return data
}

export default async function handler(req, res) {
  try {
    const sess = await sessionUser(req)
    if (!sess) return json(res, 401, { error: 'log in first' })
    const { action, plan, sessionId } = req.body || {}

    if (action === 'checkout') {
      const price = PRICE_FOR[plan]?.()
      if (!price) return json(res, 501, { error: `No Stripe price configured for "${plan}"` })
      const origin = `https://${req.headers.host}`
      const session = await stripe('checkout/sessions', {
        mode: 'subscription',
        'line_items[0][price]': price,
        'line_items[0][quantity]': '1',
        success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?sub=cancel`,
        'metadata[username]': sess.username,
        'metadata[plan]': plan,
        'subscription_data[metadata][username]': sess.username,
      })
      return json(res, 200, { url: session.url })
    }

    if (action === 'confirm') {
      if (!sessionId) return json(res, 400, { error: 'missing sessionId' })
      const session = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`)
      const paid = session.payment_status === 'paid' || session.status === 'complete'
      const username = session.metadata?.username
      const plan = session.metadata?.plan
      if (!paid || !username || !(plan in TIER_RANK)) {
        return json(res, 400, { error: 'session not paid or invalid' })
      }
      const user = sess.db.users[username]
      if (user && TIER_RANK[plan] > TIER_RANK[user.tier || 'free']) {
        user.tier = plan
        user.stripeCustomerId = session.customer || user.stripeCustomerId
        await saveUsers(sess.db)
      }
      return json(res, 200, { ok: true, tier: sess.db.users[username]?.tier })
    }

    return json(res, 400, { error: 'unknown action' })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
