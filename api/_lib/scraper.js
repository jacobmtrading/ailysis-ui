// Idea scraper — 100% code, zero LLM tokens. It used to chase big daily
// movers, i.e. buy after the move and then get stopped out on the pullback.
// Signals now, all aimed at buying BEFORE the move:
//   1. Unusual dips: major, statistically unusual drops in names whose trend
//      was intact (contrarian entry — see signals.js).
//   2. Upcoming catalysts: earnings this stock historically moves big on,
//      investor days, keynotes, FDA decisions — where the price hasn't moved.
//   3. Capitol Trades: congressional BUY disclosures, skipped if already ran.
//   4. Allocation rebalance: when the book lacks ETF ballast or drifts
//      stock-heavy, propose a core ETF (Emilia's feeding point) so the 50/50
//      ETF-vs-stock target is actually reachable.
// The chosen candidate is enriched with Google News headlines so the board
// has real context to argue about.
import { byTicker, CORE_ETFS, SCAN_TICKERS, BENCHMARK, headlineNames } from './universe.js'
import { fetchQuotes, fetchDailyBars, fetchPastEarningsDates, nyDay } from './market.js'
import { classSplit } from './state.js'
import { getJSON, setJSON } from './redis.js'
import { computeBaseline, marketMoves, excessMove, dipSetup, catalystSetup, upcomingEvents, mentions } from './signals.js'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; ailysis-paper-bot/1.0)' }
const SCAN_KEY = 'ailysis:scan'

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

// days: only headlines from the last N days (0 = any time).
export async function newsHeadlines(name, ticker, limit = 4, days = 0) {
  try {
    const q = encodeURIComponent(`"${name}" OR ${ticker} stock${days ? ` when:${days}d` : ''}`)
    const res = await fetch(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, { headers: UA })
    if (!res.ok) return []
    const xml = await res.text()
    const titles = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g)]
      .map((m) => decode(m[1]))
      .filter((t) => t && t.length > 15)
    return titles.slice(0, limit)
  } catch {
    return []
  }
}

// Major non-earnings events (investor days, keynotes, FDA…) from two weeks of
// news; signals.js keeps only the forward-looking headlines.
const EVENT_QUERY = '"investor day" OR "analyst day" OR "capital markets day" OR keynote OR "launch event" OR unveil OR FDA OR PDUFA OR "data readout"'
const decode = (s) =>
  s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim()

export async function eventHeadlines(entry, today) {
  const names = headlineNames(entry)
  try {
    const q = encodeURIComponent(`(${names.map((n) => `"${n}"`).join(' OR ')}) (${EVENT_QUERY}) when:14d`)
    const res = await fetch(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, {
      headers: UA,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
      const pub = Date.parse(it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '')
      return {
        title: decode(it.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/\s+-\s+[^-]+$/, ''),
        pub: pub ? new Date(pub).toISOString().slice(0, 10) : '1970-01-01',
      }
    })
    return upcomingEvents(items.filter((i) => i.title && mentions(names, i.title)), today)
  } catch {
    return []
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

// Per-stock baselines (volatility, 200-day average, typical earnings move…)
// and upcoming-event headlines. These only change once a day.
export async function buildScan(today = nyDay()) {
  const isStock = (t) => byTicker[t].type === 'stock'
  const [bars, reports, events] = await Promise.all([
    mapLimit(SCAN_TICKERS, 12, fetchDailyBars),
    mapLimit(SCAN_TICKERS, 6, (t) => (isStock(t) ? fetchPastEarningsDates(t) : [])),
    mapLimit(SCAN_TICKERS, 6, (t) => (isStock(t) ? eventHeadlines(byTicker[t], today) : [])),
  ])
  const baselines = {}
  const news = {}
  SCAN_TICKERS.forEach((t, i) => {
    const b = computeBaseline(bars[i], today, reports[i])
    if (b) baselines[t] = b
    if (events[i].length) news[t] = events[i]
  })
  return { day: today, builtAt: Date.now(), baselines, news }
}

// Built on the first scrape of the New York day, reused from Redis after that.
export async function loadScan() {
  const today = nyDay()
  const cached = await getJSON(SCAN_KEY).catch(() => null)
  if (cached?.day === today) return cached
  const scan = await buildScan(today)
  // Don't pin a half-failed build (data source hiccup) for the whole day.
  if (Object.keys(scan.baselines).length >= SCAN_TICKERS.length * 0.8) {
    await setJSON(SCAN_KEY, scan).catch(() => {})
  }
  return scan
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
// Returns { candidate, waiting } — waiting: dips still falling, re-checked next run.
// usOpen=false (Berlin morning before the NYSE opens) skips the dip/catalyst
// scan: quotes still carry yesterday's move, and buying that at the open is
// exactly how the fund used to end up buying after the move.
export async function findCandidate(state, scan, { usOpen = true } = {}) {
  const held = new Set(state.positions.map((p) => p.ticker))
  const now = Date.now()
  const free = (t) => byTicker[t] && !held.has(t) && !((state.cooldowns[t] || 0) > now)
  const today = nyDay()
  const base = scan?.baselines || {}

  const [capitol, quotes] = await Promise.all([
    capitolBuys(),
    usOpen ? fetchQuotes(SCAN_TICKERS, { extended: true }) : {},
  ])
  const mkt = marketMoves(quotes[BENCHMARK], base[BENCHMARK])

  const picks = {} // ticker -> { strategy, score, signals, setup, ... }
  const waiting = []
  const consider = (t, c) => {
    if (c && (!picks[t] || c.score > picks[t].score)) picks[t] = c
  }

  for (const t of usOpen ? SCAN_TICKERS : []) {
    if (!free(t)) continue
    const entry = byTicker[t]
    const dip = dipSetup(entry, quotes[t], base[t], mkt, today)
    if (dip?.waiting) waiting.push(t)
    else consider(t, dip)
    consider(t, catalystSetup(entry, quotes[t], base[t], mkt, scan?.news?.[t], today))
  }

  // Congressional buys are disclosed weeks late — skip names that already ran.
  for (const c of capitol) {
    if (!free(c.ticker)) continue
    const q = quotes[c.ticker]
    const b = base[c.ticker]
    if (q && b && excessMove(q, b, mkt, 5).z >= 1.5) continue
    const signal = `Capitol Trades: ${c.who} disclosed a buy`
    if (picks[c.ticker]) {
      picks[c.ticker].score += 1
      picks[c.ticker].signals.push(signal)
    } else {
      picks[c.ticker] = { strategy: 'insider', score: 2, signals: [signal] }
    }
  }

  const ranked = Object.entries(picks).sort((a, b) => b[1].score - a[1].score)
  const top = ranked.length ? { entry: byTicker[ranked[0][0]], ...ranked[0][1] } : null

  // ETF rebalancing competes with the top pick; it wins ties so the book
  // actually moves back toward balance when it's drifting.
  const etf = etfRebalanceCandidate(state)
  const chosen =
    etf && (!top || etf.score >= top.score)
      ? { entry: etf.entry, strategy: 'rebalance', score: etf.score, signals: [etf.signal] }
      : top
  if (!chosen) return { candidate: null, waiting }

  const { entry, ...pick } = chosen
  let headlines
  if (pick.strategy === 'dip') {
    headlines = await newsHeadlines(entry.n, entry.t, 5, 3) // why did it drop?
  } else if (pick.strategy === 'catalyst') {
    const lead = pick.event.kind === 'earnings' ? [] : [pick.event.title]
    headlines = [...new Set([...lead, ...(await newsHeadlines(entry.n, entry.t, 4, 14))])]
  } else {
    headlines = await newsHeadlines(entry.n, entry.t)
  }
  return { candidate: { ...entry, ...pick, headlines }, waiting }
}
