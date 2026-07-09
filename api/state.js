// GET /api/state — everything the frontend needs, in one response.
import { redisConfigured } from './_lib/redis.js'
import { loadState, portfolioValue, classSplit, industryWeights, START_CASH } from './_lib/state.js'
import { json } from './_lib/http.js'

export default async function handler(req, res) {
  try {
    if (!redisConfigured()) return json(res, 200, { live: false, reason: 'storage not configured' })
    const state = await loadState()
    const value = portfolioValue(state)

    const positions = state.positions
      .map((p) => {
        const price = state.lastPrices[p.ticker] || p.avgPrice
        return {
          ticker: p.ticker,
          name: p.name,
          type: p.type,
          ind: p.ind,
          qty: p.qty,
          avgPrice: p.avgPrice,
          price,
          plPct: +(((price - p.avgPrice) / p.avgPrice) * 100).toFixed(1),
          weightPct: +(((p.qty * price) / value) * 100).toFixed(1),
        }
      })
      .sort((a, b) => b.weightPct - a.weightPct)

    const orders = state.orders.map((o) => {
      const price = state.lastPrices[o.ticker]
      const plPct =
        o.side === 'sell'
          ? o.realizedPlPct
          : price
            ? +(((price - o.price) / o.price) * 100).toFixed(1)
            : 0
      return { ...o, plPct }
    })

    json(res, 200, {
      live: true,
      value: +value.toFixed(2),
      startCash: START_CASH,
      cash: +state.cash.toFixed(2),
      series: state.series,
      positions,
      orders,
      chats: state.chats,
      classSplit: classSplit(state),
      industryWeights: industryWeights(state),
      updatedAt: state.series.length ? state.series[state.series.length - 1].t : state.createdAt,
    })
  } catch (err) {
    json(res, 500, { live: false, error: String(err.message || err) })
  }
}
