// Idea scraper — 100% code, zero LLM tokens. It used to chase big daily
// movers, i.e. buy after the move and then get stopped out on the pullback.
// Signals now, all aimed at buying BEFORE the move, across ~1,500 large names:
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
import {
  CATALYST, computeBaseline, marketMoves, excessMove, dipSetup, catalystSetup, upcomingEvents, mentions, daysBetween,
} from './signals.js'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; ailysis-paper-bot/1.0)' }
const SCAN_KEY = 'ailysis:scan'
const SCAN_VERSION = 2
const EARNINGS_KEY = 'ailysis:earnings'
const SCAN_BUDGET_MS = 12000 // leaves room for quotes + a board call inside the 60s function limit
const SCAN_BATCH = 500

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

const decode = (s) =>
  s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim()

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

async function rssItems(query) {
  try {
    const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`, {
      headers: UA,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map(([, it]) => {
        const pub = Date.parse(it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '')
        return {
          title: decode(it.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/\s+-\s+[^-]+$/, ''),
          pub: pub ? new Date(pub).toISOString().slice(0, 10) : '1970-01-01',
        }
      })
      .filter((i) => i.title)
  } catch {
    return []
  }
}

// Upcoming company events from a handful of generic news searches, matched to
// scanned companies by name — ~11 requests a day instead of one per company.
// Press releases lead with the company ("BWX Technologies to Hold Investor
// Day on …"), so the name must appear within the first five words.
const EVENT_QUERIES = [
  '"to host investor day"', '"to hold investor day"', '"analyst day"', '"capital markets day"', '"investor day"',
  'PDUFA', '"FDA decision"', '"data readout"', '"to unveil"', 'keynote "next week"', '"launch event"',
]

export async function eventNews(today, tickers = SCAN_TICKERS) {
  const lists = await Promise.all(EVENT_QUERIES.map((q) => rssItems(`${q} when:14d`)))
  const seen = new Set()
  const items = lists.flat().filter((i) => !seen.has(i.title) && seen.add(i.title))

  const key = (w) => w.replace(/['’]s$/i, '').replace(/[^\p{L}\p{N}&]/gu, '').toLowerCase()
  const index = new Map() // first word of a company name -> [{ t, name }]
  for (const t of tickers) {
    const e = byTicker[t]
    if (e?.type !== 'stock') continue
    for (const name of headlineNames(e)) {
      const k = key(name.split(' ')[0])
      if (!index.has(k)) index.set(k, [])
      index.get(k).push({ t, name })
    }
  }

  const byCompany = {}
  for (const item of items) {
    const hits = new Set()
    item.title.split(/\s+/).slice(0, 5).forEach((w, pos) => {
      for (const c of index.get(key(w)) || []) {
        // One-word names ("Strategy", "Target", "Block") only count as the headline's subject.
        if ((pos === 0 || /\s/.test(c.name)) && mentions([c.name], item.title)) hits.add(c.t)
      }
    })
    for (const t of hits) (byCompany[t] ||= []).push(item)
  }
  const news = {}
  for (const [t, list] of Object.entries(byCompany)) {
    const events = upcomingEvents(list, today)
    if (events.length) news[t] = events
  }
  return news
}

// ---------- Earnings report history (Nasdaq), cached until the next report ----------
async function loadEarnings() {
  return { data: (await getJSON(EARNINGS_KEY).catch(() => null)) || {}, dirty: false }
}

const addDays = (day, n) => new Date(Date.parse(day) + n * 86400e3).toISOString().slice(0, 10)
const cachedReports = (ec, t, today) => (ec.data[t]?.until >= today ? ec.data[t].dates : undefined)

async function reportDates(t, nextDate, ec, today) {
  const hit = cachedReports(ec, t, today)
  if (hit) return hit
  const dates = (await fetchPastEarningsDates(t)).slice(0, 4)
  // Keep until the next report is out; retry soon if Nasdaq returned nothing.
  const until = !dates.length ? addDays(today, 3) : nextDate && nextDate > today ? nextDate : addDays(today, 45)
  ec.data[t] = { dates, until }
  ec.dirty = true
  return dates
}

// Run fn over items with `limit` in flight, starting no new work after the deadline.
async function eachUntil(items, limit, deadline, fn) {
  let next = 0
  const worker = async () => {
    while (next < items.length && Date.now() < deadline) await fn(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

// Per-stock baselines (volatility, 200-day average, typical earnings move…)
// change once a day, but charting ~1,500 names takes longer than one 60s
// function. Each scrape builds for up to budgetMs (benchmark and largest names
// first) and saves progress; strategies use whatever is ready. Berlin-morning
// scrapes before the NYSE opens warm it up.
export async function loadScan({ budgetMs = SCAN_BUDGET_MS } = {}) {
  const deadline = Date.now() + budgetMs
  const today = nyDay()
  let scan = await getJSON(SCAN_KEY).catch(() => null)
  if (scan?.v !== SCAN_VERSION || scan.day !== today) scan = { v: SCAN_VERSION, day: today, news: null, baselines: {} }
  const todo = SCAN_TICKERS.filter((t) => !(t in scan.baselines)).slice(0, SCAN_BATCH)
  if (scan.news && !todo.length) return scan

  if (!scan.news) scan.news = await eventNews(today)
  if (todo.length) {
    const ec = await loadEarnings()
    const quotes = await fetchQuotes(todo, { extended: true }) // next earnings dates
    await eachUntil(todo, 16, deadline, async (t) => {
      const isStock = byTicker[t].type === 'stock'
      const next = quotes[t]?.earnings?.date
      const inWindow = next && daysBetween(today, next) >= CATALYST.minDays && daysBetween(today, next) <= CATALYST.maxDays
      const [bars, dates] = await Promise.all([
        fetchDailyBars(t),
        !isStock ? [] : inWindow ? reportDates(t, next, ec, today) : cachedReports(ec, t, today),
      ])
      const b = computeBaseline(bars, today, dates || [])
      if (b) b.reportsKnown = Boolean(dates)
      scan.baselines[t] = b // null = no usable history; not retried today
    })
    if (ec.dirty) await setJSON(EARNINGS_KEY, ec.data).catch(() => {})
  }
  await setJSON(SCAN_KEY, scan).catch(() => {})
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
// Returns { candidate, waiting, scanned } — waiting: dips still falling,
// re-checked next run; scanned: names with today's baseline.
// usOpen=false (Berlin morning before the NYSE opens) skips the dip/catalyst
// scan: quotes still carry yesterday's move, and buying that at the open is
// exactly how the fund used to end up buying after the move.
export async function findCandidate(state, scan, { usOpen = true } = {}) {
  const held = new Set(state.positions.map((p) => p.ticker))
  const now = Date.now()
  const free = (t) => byTicker[t] && !held.has(t) && !((state.cooldowns[t] || 0) > now)
  const today = nyDay()
  const base = scan?.baselines || {}
  const ready = SCAN_TICKERS.filter((t) => base[t])

  const [capitol, quotes] = await Promise.all([
    capitolBuys(),
    usOpen ? fetchQuotes(ready, { extended: true }) : {},
  ])
  const mkt = marketMoves(quotes[BENCHMARK], base[BENCHMARK])

  const picks = {} // ticker -> { strategy, score, signals, setup, ... }
  const waiting = []
  const consider = (t, c) => {
    if (c && (!picks[t] || c.score > picks[t].score)) picks[t] = c
  }

  let ec = null
  for (const t of usOpen ? ready : []) {
    if (!free(t)) continue
    const entry = byTicker[t]
    let b = base[t]
    let dip = dipSetup(entry, quotes[t], b, mkt, today)
    // Was the drop right after earnings? Only looked up for actual dips (rare).
    if (dip && !dip.waiting && !b.reportsKnown) {
      ec = ec || (await loadEarnings())
      const dates = await reportDates(t, quotes[t]?.earnings?.date, ec, today)
      b = { ...b, lastReport: dates[0] || null, reportsKnown: true }
      dip = dipSetup(entry, quotes[t], b, mkt, today)
    }
    if (dip?.waiting) waiting.push(t)
    else consider(t, dip)
    consider(t, catalystSetup(entry, quotes[t], b, mkt, scan?.news?.[t], today))
  }
  if (ec?.dirty) await setJSON(EARNINGS_KEY, ec.data).catch(() => {})

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
  if (!chosen) return { candidate: null, waiting, scanned: ready.length }

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
  return { candidate: { ...entry, ...pick, headlines }, waiting, scanned: ready.length }
}
