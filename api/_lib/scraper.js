// Idea scraper — 100% code, zero LLM tokens. Signals:
//   1. Capitol Trades: recent congressional BUY disclosures
//   2. Big daily movers on the watchlist (|day change| >= 3%)
// The chosen candidate is enriched with Google News headlines so the board
// has real context to argue about.
import { UNIVERSE, byTicker, WATCHLIST } from './universe.js'
import { fetchQuotes } from './market.js'

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
  for (const m of movers) bump(m.ticker, 1, `Price move: ${m.dayChgPct > 0 ? '+' : ''}${m.dayChgPct}% today`)

  const ranked = Object.entries(scores).sort((a, b) => b[1].score - a[1].score)
  if (!ranked.length) return null

  const [ticker, info] = ranked[0]
  const entry = byTicker[ticker]
  const headlines = await newsHeadlines(entry.n, ticker)
  return { ...entry, signals: info.signals, score: info.score, headlines }
}
