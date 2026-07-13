// Premium insight tools (auth required, tier-gated, daily-capped):
// POST /api/insights { action: 'map',    items }              — premium+ (1 item) / tailormade (portfolio)
// POST /api/insights { action: 'swot',   items, label }       — same gating
// POST /api/insights { action: 'stress', items, scenarioId }  — same gating
import { sessionUser, loadUserData, saveUserData, TIER_RANK } from './_lib/auth.js'
import { runMap, runSwot, runStress } from './_lib/insights.js'
import { scenarioById } from './_lib/scenarios.js'
import { berlinDay } from './_lib/market.js'
import { byTicker, UNIVERSE } from './_lib/universe.js'
import { json } from './_lib/http.js'

// Insights are cheaper than full board sessions, so they get their own
// (more generous) daily budget, tracked separately from studio usage.
const DAILY_CAP = { premium: 10, tailormade: 30 }

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'POST only' })
    const sess = await sessionUser(req)
    if (!sess) return json(res, 401, { error: 'log in first' })
    const tier = sess.user.tier || 'free'

    const { action } = req.body || {}
    if (!['map', 'swot', 'stress'].includes(action)) return json(res, 400, { error: 'unknown action' })

    // Validate + enrich positions against the universe.
    const items = (Array.isArray(req.body.items) ? req.body.items : [])
      .slice(0, 15)
      .map((p) => ({
        ticker: String(p?.ticker || '').toUpperCase().slice(0, 8),
        weightPct: Math.max(1, Math.min(100, Number(p?.weightPct) || 0)),
      }))
      .filter((p) => p.ticker && byTicker[p.ticker])
      .map((p) => {
        const u = byTicker[p.ticker]
        return { ticker: p.ticker, name: u.n, industry: u.ind, type: u.type, weightPct: p.weightPct }
      })
    if (!items.length) return json(res, 400, { error: 'No known tickers provided' })

    // Single-stock tools ride on the Premium analysis feature; portfolio-level
    // tools belong to the Tailormade builder/check features.
    const needTier = items.length > 1 ? 'tailormade' : 'premium'
    if (TIER_RANK[tier] < TIER_RANK[needTier]) {
      return json(res, 403, { error: `This feature needs the ${needTier} subscription`, needTier })
    }

    const udata = await loadUserData(sess.username)
    const day = `${berlinDay()}#insights`
    const used = udata.usage[day] || 0
    if (used >= (DAILY_CAP[tier] || 0)) {
      return json(res, 429, { error: `Daily limit reached (${DAILY_CAP[tier]} insight runs/day)` })
    }

    let out = null

    if (action === 'map') {
      const universe = UNIVERSE.map((u) => ({ ticker: u.t, name: u.n, industry: u.ind, type: u.type }))
      out = await runMap({ items, universe })
      // The client draws industry clusters — attach industries it can trust.
      const withInd = (list) =>
        list.map((s) => ({ ...s, name: byTicker[s.ticker]?.n, industry: byTicker[s.ticker]?.ind, type: byTicker[s.ticker]?.type }))
      out = { stocks: withInd(out.stocks), proposals: withInd(out.proposals) }
    }

    if (action === 'swot') {
      const label = String(req.body.label || '').slice(0, 120)
      const subject =
        items.length === 1
          ? { kind: 'single', ...items[0] }
          : { kind: 'portfolio', label: label || 'Client portfolio', positions: items }
      out = await runSwot({ subject })
    }

    if (action === 'stress') {
      const scenario = scenarioById[String(req.body.scenarioId || '')]
      if (!scenario) return json(res, 400, { error: 'Pick a scenario from the library' })
      out = await runStress({ scenario, items })
      out.scenarioId = scenario.id
    }

    udata.usage[day] = used + 1
    await saveUserData(sess.username, udata)
    return json(res, 200, { ...out, remaining: (DAILY_CAP[tier] || 0) - used - 1 })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
