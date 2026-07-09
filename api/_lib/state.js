import { getJSON, setJSON } from './redis.js'

export const STATE_KEY = 'ailysis:state'
export const START_CASH = 100000

export function defaultState() {
  return {
    cash: START_CASH,
    positions: [], // { ticker, name, type, ind, qty, avgPrice, stopPct, buyTime }
    orders: [], // newest first: { id, ticker, name, side, qty, price, time, realizedPlPct?, chatId }
    chats: {}, // chatId -> { id, ticker, name, source, time, messages: [...] }
    series: [], // hourly: { t, v }
    lastPrices: {}, // ticker -> price
    cooldowns: {}, // ticker -> expiry epoch ms (don't re-discuss too soon)
    daily: {}, // berlinDay -> { boards: n, reviewed: bool }
    createdAt: Date.now(),
  }
}

export async function loadState() {
  return (await getJSON(STATE_KEY)) || defaultState()
}

export async function saveState(state) {
  // Keep the blob bounded.
  state.orders = state.orders.slice(0, 60)
  const keepChatIds = new Set(state.orders.map((o) => o.chatId).filter(Boolean))
  for (const id of Object.keys(state.chats)) if (!keepChatIds.has(id)) delete state.chats[id]
  if (state.series.length > 6000) state.series = state.series.slice(-6000)
  const days = Object.keys(state.daily).sort()
  for (const d of days.slice(0, -7)) delete state.daily[d]
  await setJSON(STATE_KEY, state)
}

export function portfolioValue(state) {
  return state.cash + state.positions.reduce((s, p) => s + p.qty * (state.lastPrices[p.ticker] || p.avgPrice), 0)
}

export function classSplit(state) {
  const total = portfolioValue(state)
  const val = (type) =>
    state.positions.filter((p) => p.type === type).reduce((s, p) => s + p.qty * (state.lastPrices[p.ticker] || p.avgPrice), 0)
  const stocks = val('stock')
  const etfs = val('etf')
  return {
    stocksPct: total ? +((stocks / total) * 100).toFixed(1) : 0,
    etfsPct: total ? +((etfs / total) * 100).toFixed(1) : 0,
    cashPct: total ? +((state.cash / total) * 100).toFixed(1) : 100,
  }
}

export function industryWeights(state) {
  const total = portfolioValue(state)
  const out = {}
  for (const p of state.positions) {
    const v = p.qty * (state.lastPrices[p.ticker] || p.avgPrice)
    out[p.ind] = (out[p.ind] || 0) + v
  }
  for (const k of Object.keys(out)) out[k] = +((out[k] / total) * 100).toFixed(1)
  return out
}
