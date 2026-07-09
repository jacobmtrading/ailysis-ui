// Order execution, hard guardrails, and chat assembly.
// Guardrails are enforced in CODE — the LLM is advisory, the code has final say.
import { portfolioValue, classSplit, industryWeights } from './state.js'

export const INDUSTRY_CAP_PCT = 30 // Rayan's rule
export const ETF_BALANCE_TOLERANCE = 10 // Emilia's rule: 50/50 ±10

// Diversified ETF "industries" don't count as concentration risk, so they're
// exempt from the per-industry cap (a broad-market ETF isn't a sector bet).
const BROAD_INDUSTRIES = new Set(['Broad Market', 'International', 'Dividend', 'Commodities'])

function chatTime(offsetMin = 0) {
  const d = new Date(Date.now() - offsetMin * 60000)
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

// Turn board output into the chat shape the UI renders (WhatsApp-style).
export function assembleChat({ id, ticker, name, source, board, question, decisionLine }) {
  const n = board.messages.length
  const messages = board.messages.map((m, i) => ({
    from: m.from,
    text: m.text,
    time: chatTime((n - i + 2) * 1),
  }))
  messages.push({ from: 'mod', text: `Alright board — calling the vote. ${question}`, time: chatTime(2) })
  messages.push({
    from: 'mod',
    poll: true,
    question,
    time: chatTime(1),
    votes: Object.entries(board.votes).map(([agent, vote]) => ({ agent, vote })),
  })
  messages.push({ from: 'mod', text: decisionLine || board.closing || 'Decision recorded.', time: chatTime(0) })
  return { id, ticker, name, source, time: Date.now(), messages }
}

// Clamp a proposed buy so it cannot break the industry cap or the 50/50 rule.
// Returns { sizePct, notes } — sizePct may be 0 (forced pass).
export function applyGuardrails(state, entry, proposedSizePct) {
  const notes = []
  let sizePct = proposedSizePct
  const value = portfolioValue(state)

  // Rayan: industry concentration cap (single stocks and sector ETFs).
  // Broad, diversified ETFs are exempt — they aren't a concentrated bet.
  if (!BROAD_INDUSTRIES.has(entry.ind)) {
    const weights = industryWeights(state)
    const current = weights[entry.ind] || 0
    if (current + sizePct > INDUSTRY_CAP_PCT) {
      sizePct = Math.max(0, +(INDUSTRY_CAP_PCT - current).toFixed(1))
      notes.push(`Rayan's cap: ${entry.ind} would exceed ${INDUSTRY_CAP_PCT}% — size cut to ${sizePct}%`)
    }
  }

  // Emilia: keep stocks vs ETFs near 50/50 (of invested capital).
  const split = classSplit(state)
  const invested = split.stocksPct + split.etfsPct
  if (invested > 20) {
    const stockShare = (split.stocksPct / invested) * 100
    if (entry.type === 'stock' && stockShare > 50 + ETF_BALANCE_TOLERANCE) {
      sizePct = Math.min(sizePct, 1)
      notes.push(`Emilia's rule: book is ${stockShare.toFixed(0)}% stocks — stock buys capped at 1%`)
    }
    if (entry.type === 'etf' && stockShare < 50 - ETF_BALANCE_TOLERANCE) {
      sizePct = Math.min(sizePct, 1)
      notes.push(`Emilia's rule: book is already ETF-heavy — ETF buys capped at 1%`)
    }
  }

  // Cash check.
  const cost = (value * sizePct) / 100
  if (cost > state.cash) {
    sizePct = +((state.cash / value) * 100 * 0.95).toFixed(1)
    notes.push(`Cash constraint: size reduced to ${sizePct}%`)
  }
  if (sizePct < 0.5) sizePct = 0
  return { sizePct, notes }
}

export function executeBuy(state, entry, price, sizePct, stopPct, chatId) {
  const value = portfolioValue(state)
  const budget = (value * sizePct) / 100
  const qty = Math.max(1, Math.floor(budget / price))
  const cost = qty * price
  if (cost > state.cash) return null

  state.cash -= cost
  const existing = state.positions.find((p) => p.ticker === entry.t)
  if (existing) {
    existing.avgPrice = (existing.avgPrice * existing.qty + cost) / (existing.qty + qty)
    existing.qty += qty
  } else {
    state.positions.push({
      ticker: entry.t,
      name: entry.n,
      type: entry.type,
      ind: entry.ind,
      qty,
      avgPrice: price,
      stopPct,
      buyTime: Date.now(),
    })
  }
  state.lastPrices[entry.t] = price
  const order = {
    id: `${entry.t}-${Date.now()}`,
    ticker: entry.t,
    name: entry.n,
    side: 'buy',
    qty,
    price,
    time: Date.now(),
    chatId,
  }
  state.orders.unshift(order)
  return order
}

export function executeSell(state, ticker, price, portionPct, chatId) {
  const pos = state.positions.find((p) => p.ticker === ticker)
  if (!pos) return null
  const qty = portionPct >= 100 ? pos.qty : Math.max(1, Math.floor((pos.qty * portionPct) / 100))
  const proceeds = qty * price
  const realizedPlPct = +(((price - pos.avgPrice) / pos.avgPrice) * 100).toFixed(1)

  state.cash += proceeds
  pos.qty -= qty
  if (pos.qty <= 0) state.positions = state.positions.filter((p) => p.ticker !== ticker)

  const order = {
    id: `${ticker}-sell-${Date.now()}`,
    ticker,
    name: pos.name,
    side: 'sell',
    qty,
    price,
    time: Date.now(),
    realizedPlPct,
    chatId,
  }
  state.orders.unshift(order)
  return order
}

// Stop-loss sells don't burn LLM tokens — the chat is templated.
export function stopLossChat(pos, price, plPct) {
  const id = `chat-stop-${pos.ticker}-${Date.now()}`
  return {
    id,
    ticker: pos.ticker,
    name: pos.name,
    source: 'Automatic stop-loss',
    time: Date.now(),
    messages: [
      {
        from: 'rayan',
        text: `⚠️ ${pos.ticker} just breached its ${pos.stopPct}% stop (${plPct.toFixed(1)}% from entry at $${price.toFixed(2)}). Rules are rules — I'm triggering the exit.`,
        time: chatTime(1),
      },
      {
        from: 'mod',
        text: `Stop-loss executed. Sold ${pos.ticker} at $${price.toFixed(2)} (${plPct.toFixed(1)}%). No vote needed — risk rules are binding. 🔴`,
        time: chatTime(0),
      },
    ],
  }
}
