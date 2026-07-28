// POST /api/ingest — the council engine pushes its full state blob here.
// Auth: same CRON_SECRET bearer scheme as the cron endpoints. The blob replaces
// the engine-owned fields of ailysis:state; saveState() applies the usual
// bounding (60 orders, orphan-chat pruning, 6000 series points).
import { redisConfigured } from './_lib/redis.js'
import { loadState, saveState, defaultState } from './_lib/state.js'
import { authorized, json } from './_lib/http.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'POST only' })
    if (!authorized(req)) return json(res, 401, { error: 'unauthorized' })
    if (!redisConfigured()) return json(res, 500, { error: 'storage not configured' })

    const body = req.body
    if (
      !body ||
      typeof body.cash !== 'number' ||
      !Array.isArray(body.positions) ||
      !Array.isArray(body.orders) ||
      !Array.isArray(body.series) ||
      typeof body.chats !== 'object'
    ) {
      return json(res, 400, { error: 'bad state blob' })
    }

    const prev = (await loadState()) || defaultState()
    const state = {
      ...prev,
      cash: body.cash,
      positions: body.positions,
      orders: body.orders,
      chats: body.chats || {},
      series: body.series,
      lastPrices: body.lastPrices || {},
      createdAt: body.createdAt || prev.createdAt,
      engine: body.engine || 'council',
    }
    await saveState(state)
    json(res, 200, {
      ok: true,
      positions: state.positions.length,
      orders: state.orders.length,
      chats: Object.keys(state.chats).length,
      series: state.series.length,
    })
  } catch (err) {
    json(res, 500, { error: String(err.message || err) })
  }
}
