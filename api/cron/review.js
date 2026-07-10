// GET /api/cron/review?token=SECRET — once per trading day (one DeepSeek call).
// The board reviews all holdings and may sell up to two positions.
import { loadState, saveState, portfolioValue, classSplit, industryWeights } from '../_lib/state.js'
import { anyMarketOpen, berlinDay } from '../_lib/market.js'
import { runReview } from '../_lib/board.js'
import { assembleChat, executeSell } from '../_lib/portfolio.js'
import { authorized, json } from '../_lib/http.js'

export default async function handler(req, res) {
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' })
  const force = req.query?.force === '1'
  if (!anyMarketOpen() && !force) return json(res, 200, { skipped: 'markets closed' })

  try {
    const state = await loadState()
    const day = berlinDay()
    state.daily[day] = state.daily[day] || { boards: 0, reviewed: false }
    if (state.daily[day].reviewed && !force) return json(res, 200, { skipped: 'already reviewed today' })
    if (!state.positions.length) return json(res, 200, { skipped: 'no positions to review' })

    const positions = state.positions.map((p) => {
      const price = state.lastPrices[p.ticker] || p.avgPrice
      return {
        ticker: p.ticker,
        name: p.name,
        type: p.type,
        industry: p.ind,
        plPct: +(((price - p.avgPrice) / p.avgPrice) * 100).toFixed(1),
        weightPct: +(((p.qty * price) / portfolioValue(state)) * 100).toFixed(1),
        heldDays: Math.round((Date.now() - p.buyTime) / 86400e3),
      }
    })
    const snapshot = {
      total_value: +portfolioValue(state).toFixed(0),
      cash: +state.cash.toFixed(0),
      class_split: classSplit(state),
      industry_weights: industryWeights(state),
    }

    const board = await runReview({ positions, snapshot })
    state.daily[day].reviewed = true

    const chatId = `chat-review-${Date.now()}`
    const executed = []
    for (const sell of board.sells) {
      const price = state.lastPrices[sell.ticker]
      if (!price) continue
      const order = executeSell(state, sell.ticker, price, sell.portionPct, chatId)
      if (order) executed.push(`${sell.ticker} ${sell.portionPct}%`)
    }

    const chat = assembleChat({
      id: chatId,
      ticker: 'REVIEW',
      name: 'Daily portfolio review',
      source: board.proposal,
      board,
      question: board.proposal,
      decisionLine: `${board.closing || ''}${executed.length ? ` Executed: sold ${executed.join(', ')}. 🔴` : ' Holding everything. ⚪️'}`,
    })
    state.chats[chatId] = chat
    // Always add a "Daily review" entry so the sell discussion is visible in
    // the order history even on days when nothing is sold.
    state.orders.unshift({
      id: `review-${Date.now()}`,
      ticker: 'REVIEW',
      name: 'Daily portfolio review',
      side: 'review',
      qty: 0,
      price: 0,
      time: Date.now(),
      chatId,
    })

    await saveState(state)
    json(res, 200, { ok: true, sells: executed, votes: board.votes })
  } catch (err) {
    json(res, 500, { error: String(err.message || err) })
  }
}
