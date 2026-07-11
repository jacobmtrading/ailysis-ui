// Stripe subscriptions + one-time (lifetime) via plain REST (no SDK).
// GET  /api/stripe            -> public list of plans with live prices
// POST /api/stripe {action:'checkout', plan}  -> { url }
// POST /api/stripe {action:'confirm', sessionId} -> upgrades tier if paid
import { sessionUser, saveUsers, TIER_RANK } from './_lib/auth.js'
import { json } from './_lib/http.js'

// Your Stripe PRODUCT ids. The backend resolves each product's price + mode.
const STRIPE_PRODUCTS = {
  premium_monthly: 'prod_TSzsTMs1ESkBhJ',
  premium_yearly: 'prod_TSzt4hMMjghVTy',
  tailormade_monthly: 'prod_TSztKX2ar2LxNo',
  tailormade_yearly: 'prod_TSzuyNNzKSiros',
  tailormade_lifetime: 'prod_TSzuRQDd9V2lkO',
}
const PLAN_TIER = {
  premium_monthly: 'premium',
  premium_yearly: 'premium',
  tailormade_monthly: 'tailormade',
  tailormade_yearly: 'tailormade',
  tailormade_lifetime: 'tailormade',
}
const PLAN_ORDER = Object.keys(STRIPE_PRODUCTS)

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

// product id -> { name, priceId, mode, interval, amount, currency }
async function resolvePlan(productId) {
  const product = await stripe(`products/${productId}?expand[]=default_price`)
  let price = product.default_price
  if (typeof price === 'string') price = await stripe(`prices/${price}`)
  if (!price) {
    const list = await stripe(`prices?product=${productId}&active=true&limit=1`)
    price = list.data?.[0]
  }
  if (!price) throw new Error(`No active price on product ${productId}`)
  return {
    name: product.name,
    priceId: price.id,
    mode: price.recurring ? 'subscription' : 'payment',
    interval: price.recurring?.interval || 'lifetime',
    amount: price.unit_amount,
    currency: price.currency,
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const plans = []
      for (const key of PLAN_ORDER) {
        try {
          const p = await resolvePlan(STRIPE_PRODUCTS[key])
          plans.push({ key, tier: PLAN_TIER[key], ...p })
        } catch {
          /* skip a plan whose product/price isn't set up yet */
        }
      }
      return json(res, 200, { plans })
    }

    const sess = await sessionUser(req)
    if (!sess) return json(res, 401, { error: 'log in first' })
    const { action, plan, sessionId } = req.body || {}

    if (action === 'checkout') {
      // Soft gate: require a confirmed email before taking money.
      if (!sess.user.emailVerified)
        return json(res, 403, { error: 'Please confirm your email before subscribing', needsVerify: true })
      const productId = STRIPE_PRODUCTS[plan]
      if (!productId) return json(res, 400, { error: 'unknown plan' })
      const info = await resolvePlan(productId)
      const origin = `https://${req.headers.host}`
      const session = await stripe('checkout/sessions', {
        mode: info.mode,
        'line_items[0][price]': info.priceId,
        'line_items[0][quantity]': '1',
        success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?sub=cancel`,
        'metadata[username]': sess.username,
        'metadata[plan]': plan,
        'metadata[tier]': PLAN_TIER[plan],
        ...(info.mode === 'subscription' ? { 'subscription_data[metadata][username]': sess.username } : {}),
      })
      return json(res, 200, { url: session.url })
    }

    if (action === 'confirm') {
      if (!sessionId) return json(res, 400, { error: 'missing sessionId' })
      const session = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`)
      const paid = session.payment_status === 'paid' || session.status === 'complete'
      const tier = session.metadata?.tier
      if (!paid || session.metadata?.username !== sess.username || !(tier in TIER_RANK)) {
        return json(res, 400, { error: 'payment not completed' })
      }
      if (TIER_RANK[tier] > TIER_RANK[sess.user.tier || 'free']) {
        sess.user.tier = tier
        sess.user.stripeCustomerId = session.customer || sess.user.stripeCustomerId
        await saveUsers(sess.db)
      }
      return json(res, 200, { ok: true, tier: sess.user.tier })
    }

    return json(res, 400, { error: 'unknown action' })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
