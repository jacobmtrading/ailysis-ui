// Idea scraper — 100% code, zero LLM tokens. Signals:
//   1. Capitol Trades: recent congressional BUY disclosures (stocks)
//   2. Big daily movers on the watchlist (|day change| >= 3%) (stocks)
//   3. Allocation rebalance: when the book lacks ETF ballast or drifts
//      stock-heavy, propose a core ETF (Emilia's feeding point) so the 50/50
//      ETF-vs-stock target is actually reachable.
// The chosen candidate is enriched with Google News headlines so the board
// has real context to argue about.
import { UNIVERSE, byTicker, WATCHLIST, CORE_ETFS, SECTOR_ETF } from './universe.js'
import { fetchQuotes } from './market.js'
import { classSplit } from './state.js'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; ailysis-paper-bot/1.0)' }

export async function capitolBuys() {
  try {
    const res = await fetch('https://bff.capitoltrades.com/trades?pageSize=50&sortBy=-pubDate', { headers: UA })
    if (!res.ok) return []
    const data = await res.json()
    const items = data?.data || []
    const cutoff = Date.now() - 10 * 86400e3
    const out = []
    for (const tr of items) {
      const raw = tr?.issuer?.issuerTicker || tr?.asset?.assetTicker || ''
      const ticker = String(raw).replace(/:US$/, '')
      if (!byTicker[ticker]) continue
      if (String(tr?.txType).toLowerCase() !== 'buy') continue
      const when = Date.parse(tr?.pubDate || tr?.txDate || '')
      if (!when || when < cutoff) continue
      const who = [tr?.politician?.firstName, tr?.politician?.lastName].filter(Boolean).join(' ') || 'a member of Congress'
      out.push({ ticker, who })
    }
    return out
  } catch {
    return []
  }
}

export async function bigMovers() {
  const quotes = await fetchQuotes(WATCHLIST)
  return Object.entries(quotes)
    .filter(([, q]) => Math.abs(q.dayChgPct) >= 3)
    .map(([ticker, q]) => ({ ticker, dayChgPct: +q.dayChgPct.toFixed(1) }))
}

export async function newsHeadlines(name, ticker, limit = 4) {
  try {
    const q = encodeURIComponent(`"${name}" OR ${ticker} stock`)
    const res = await fetch(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, { headers: UA })
    if (!res.ok) return []
    const xml = await res.text()
    const titles = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g)]
      .map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim())
      .filter((t) => t && t.length > 15)
    return titles.slice(0, limit)
  } catch {
    return []
  }
}

// Emilia's feeding point: if the book has no ETF ballast or has drifted
// stock-heavy, propose a core ETF so the 50/50 target is actually reachable.
// This is the ONE candidate allowed to be already-held (we top it up).
export function etfRebalanceCandidate(state) {
  const hasStocks = state.positions.some((p) => p.type === 'stock')
  if (!hasStocks) return null // nothing to balance against yet

  const split = classSplit(state)
  const invested = split.stocksPct + split.etfsPct
  const stockShare = invested > 0 ? (split.stocksPct / invested) * 100 : 100
  const hasEtfs = state.positions.some((p) => p.type === 'etf')
  if (hasEtfs && stockShare <= 55) return null // balanced enough

  // Prefer an un-held core ETF not on cooldown; otherwise top up the smallest
  // ETF we hold. Returns null if there's nothing sensible to propose (so a run
  // of "pass" votes can't loop on the same ticker every scrape).
  const now = Date.now()
  const cooled = (t) => (state.cooldowns[t] || 0) > now
  const heldTickers = new Set(state.positions.map((p) => p.ticker))
  let pick = CORE_ETFS.find((t) => !heldTickers.has(t) && !cooled(t))
  if (!pick) {
    const etfPos = state.positions
      .filter((p) => p.type === 'etf')
      .sort((a, b) => a.qty * a.avgPrice - b.qty * b.avgPrice)
    pick = etfPos.length ? etfPos[0].ticker : null
  }
  if (!pick) return null

  const imbalance = Math.max(0, stockShare - 50)
  const score = (hasEtfs ? 2 : 3) + Math.floor(imbalance / 4)
  const signal = hasEtfs
    ? `Emilia's rebalance: book is ${stockShare.toFixed(0)}% stocks vs ETFs — proposing ${pick} to move toward 50/50`
    : `Emilia's allocation: no ETF ballast yet — proposing core ETF ${pick} to build the 50/50 base`
  return { entry: byTicker[pick], score, signal }
}

// Pick the single best candidate not already held / recently discussed.
export async function findCandidate(state) {
  const held = new Set(state.positions.map((p) => p.ticker))
  const now = Date.now()
  const cooled = (t) => (state.cooldowns[t] || 0) > now

  const [capitol, movers] = await Promise.all([capitolBuys(), bigMovers()])

  const scores = {} // ticker -> { score, signals: [] }
  const bump = (ticker, pts, signal) => {
    if (held.has(ticker) || cooled(ticker)) return
    scores[ticker] = scores[ticker] || { score: 0, signals: [] }
    scores[ticker].score += pts
    scores[ticker].signals.push(signal)
  }

  for (const c of capitol) bump(c.ticker, 2, `Capitol Trades: ${c.who} disclosed a buy`)
  for (const m of movers) {
    bump(m.ticker, 1, `Price move: ${m.dayChgPct > 0 ? '+' : ''}${m.dayChgPct}% today`)
    // News/momentum-driven ETF path: a hot sector surfaces its sector ETF too.
    if (m.dayChgPct > 0) {
      const stock = byTicker[m.ticker]
      const etfT = stock && SECTOR_ETF[stock.ind]
      if (etfT) bump(etfT, 1, `Sector momentum: ${stock.ind} running — ${m.ticker} +${m.dayChgPct}%`)
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1].score - a[1].score)
  const topStock = ranked.length
    ? { entry: byTicker[ranked[0][0]], signals: ranked[0][1].signals, score: ranked[0][1].score }
    : null

  // ETF rebalancing competes with the top stock; it wins ties so the book
  // actually moves back toward balance when it's drifting.
  const etf = etfRebalanceCandidate(state)
  let chosen = null
  if (etf && (!topStock || etf.score >= topStock.score)) {
    chosen = { entry: etf.entry, signals: [etf.signal], score: etf.score }
  } else if (topStock) {
    chosen = topStock
  } else if (etf) {
    chosen = { entry: etf.entry, signals: [etf.signal], score: etf.score }
  }
  if (!chosen) return null

  const headlines = await newsHeadlines(chosen.entry.n, chosen.entry.t)
  return { ...chosen.entry, signals: chosen.signals, score: chosen.score, headlines }
}
