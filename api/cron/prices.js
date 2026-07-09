// GET /api/cron/prices?token=SECRET — hourly during market hours.
// Zero LLM cost: refreshes quotes, appends a portfolio value point,
// and enforces stop-losses (with a templated chat, no tokens).
import { loadState, saveState, portfolioValue } from '../_lib/state.js'
import { fetchQuotes, anyMarketOpen } from '../_lib/market.js'
import { executeSell, stopLossChat } from '../_lib/portfolio.js'
import { authorized, json } from '../_lib/http.js'

export default async function handler(req, res) {
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' })
  const force = req.query?.force === '1'
  if (!anyMarketOpen() && !force) return json(res, 200, { skipped: 'markets closed' })

  try {
    const state = await loadState()
    const tickers = state.positions.map((p) => p.ticker)
    const quotes = tickers.length ? await fetchQuotes(tickers) : {}
    for (const [t, q] of Object.entries(quotes)) state.lastPrices[t] = q.price

    // Binding stop-losses — code-enforced, no board call needed.
    const stopped = []
    for (const pos of [...state.positions]) {
      const price = state.lastPrices[pos.ticker]
      if (!price) continue
      const plPct = ((price - pos.avgPrice) / pos.avgPrice) * 100
      if (plPct <= -pos.stopPct) {
        const chat = stopLossChat(pos, price, plPct)
        state.chats[chat.id] = chat
        executeSell(state, pos.ticker, price, 100, chat.id)
        stopped.push(pos.ticker)
      }
    }

    // Append an hourly value point (dedupe within 45 min).
    const value = +portfolioValue(state).toFixed(2)
    const last = state.series[state.series.length - 1]
    if (!last || Date.now() - last.t > 45 * 60000) {
      state.series.push({ t: Date.now(), v: value })
    } else {
      last.v = value
    }

    await saveState(state)
    json(res, 200, { ok: true, value, quotes: Object.keys(quotes).length, stopped })
  } catch (err) {
    json(res, 500, { error: String(err.message || err) })
  }
}
