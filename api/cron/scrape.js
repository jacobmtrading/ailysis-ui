// GET /api/cron/scrape?token=SECRET — every 15-30 min during market hours.
// Scraping + scoring is free (pure code). The board (one DeepSeek call) only
// convenes when a genuine candidate is found, capped per day.
import { loadState, saveState, portfolioValue, classSplit, industryWeights } from '../_lib/state.js'
import { anyMarketOpen, berlinDay, fetchQuote, fetchStats } from '../_lib/market.js'
import { findCandidate } from '../_lib/scraper.js'
import { runBoard } from '../_lib/board.js'
import { assembleChat, applyGuardrails, executeBuy } from '../_lib/portfolio.js'
import { authorized, json } from '../_lib/http.js'

const BOARDS_PER_DAY = Number(process.env.BOARD_DAILY_MAX || 6)
const COOLDOWN_DAYS = 7

export default async function handler(req, res) {
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' })
  const force = req.query?.force === '1'
  if (!anyMarketOpen() && !force) return json(res, 200, { skipped: 'markets closed' })

  try {
    const state = await loadState()
    const day = berlinDay()
    state.daily[day] = state.daily[day] || { boards: 0, reviewed: false }
    if (state.daily[day].boards >= BOARDS_PER_DAY) {
      return json(res, 200, { skipped: `daily board budget reached (${BOARDS_PER_DAY})` })
    }

    const candidate = await findCandidate(state)
    if (!candidate) {
      await saveState(state)
      return json(res, 200, { ok: true, candidate: null, note: 'nothing interesting found — no tokens spent' })
    }

    // Real data for the board: live quote + chart stats + true portfolio state.
    const [quote, stats] = await Promise.all([fetchQuote(candidate.t), fetchStats(candidate.t)])
    if (!quote) {
      state.cooldowns[candidate.t] = Date.now() + 86400e3 // no price → retry tomorrow
      await saveState(state)
      return json(res, 200, { ok: true, skipped: `no quote for ${candidate.t}` })
    }

    const snapshot = {
      total_value: +portfolioValue(state).toFixed(0),
      cash: +state.cash.toFixed(0),
      class_split: classSplit(state),
      industry_weights: industryWeights(state),
      holdings: state.positions.map((p) => `${p.ticker} (${p.ind}, ${p.type})`),
    }

    const board = await runBoard({ candidate, stats, snapshot })
    state.daily[day].boards += 1
    state.cooldowns[candidate.t] = Date.now() + COOLDOWN_DAYS * 86400e3

    let result = 'pass'
    let guardrailNotes = []
    const chatId = `chat-${candidate.t}-${Date.now()}`

    if (board.decision.action === 'buy') {
      const { sizePct, notes } = applyGuardrails(state, candidate, board.decision.sizePct)
      guardrailNotes = notes
      if (sizePct > 0) {
        const order = executeBuy(state, candidate, quote.price, sizePct, board.decision.stopPct, chatId)
        if (order) result = `bought ${order.qty} @ $${quote.price}`
      } else {
        result = 'pass (guardrails vetoed the buy)'
      }
    }

    const yes = Object.values(board.votes).filter((v) => v === 'yes').length
    const decisionLine =
      result.startsWith('bought')
        ? `${board.closing || ''} Executed: ${result}, stop ${board.decision.stopPct}%. 🟢${guardrailNotes.length ? ` (${guardrailNotes.join('; ')})` : ''}`
        : `${board.closing || ''} Vote ${yes}-${5 - yes}. No trade. ⚪️${guardrailNotes.length ? ` (${guardrailNotes.join('; ')})` : ''}`

    const chat = assembleChat({
      id: chatId,
      ticker: candidate.t,
      name: candidate.n,
      source: candidate.signals.join(' · '),
      board,
      question: `BUY ${candidate.t}?`,
      decisionLine: decisionLine.trim(),
    })
    state.chats[chatId] = chat

    // Keep a chat visible even when the board passes: attach a zero-qty "pass"
    // marker only if a real order wasn't created.
    if (result.startsWith('pass')) {
      state.orders.unshift({
        id: `${candidate.t}-pass-${Date.now()}`,
        ticker: candidate.t,
        name: candidate.n,
        side: 'pass',
        qty: 0,
        price: quote.price,
        time: Date.now(),
        chatId,
      })
    }

    await saveState(state)
    json(res, 200, { ok: true, candidate: candidate.t, votes: board.votes, result, guardrailNotes })
  } catch (err) {
    json(res, 500, { error: String(err.message || err) })
  }
}
