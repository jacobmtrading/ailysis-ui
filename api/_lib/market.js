// Market hours (Xetra + NYSE) and free keyless price data.
// Primary: CNBC quote API (batched — the whole portfolio in ONE request).
// Fallback: Stooq CSV. Both free, no API keys.

function tzParts(tz, date = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const p = {}
  for (const { type, value } of dtf.formatToParts(date)) p[type] = value
  return { dow: p.weekday, min: (p.hour === '24' ? 0 : +p.hour) * 60 + +p.minute }
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export function isXetraOpen(date = new Date()) {
  const { dow, min } = tzParts('Europe/Berlin', date)
  return WEEKDAYS.includes(dow) && min >= 9 * 60 && min < 17 * 60 + 30
}

export function isNyseOpen(date = new Date()) {
  const { dow, min } = tzParts('America/New_York', date)
  return WEEKDAYS.includes(dow) && min >= 9 * 60 + 30 && min < 16 * 60
}

export function anyMarketOpen(date = new Date()) {
  return isXetraOpen(date) || isNyseOpen(date)
}

// Berlin calendar date string, used for daily budgets/flags.
export function berlinDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(date)
}

// New York calendar date string — the trading day of the US-listed universe.
export function nyDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date)
}

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' }

const cnbcSym = (t) => t.replace(/-/g, '.') // BRK-B -> BRK.B
const num = (s) => {
  const v = parseFloat(String(s).replace(/[%,]/g, ''))
  return isFinite(v) ? v : null
}

// CNBC EventData: "10/28/2026(est)" + announce_time A/B -> { date, confirmed, timing }
function parseEarnings(ev) {
  const m = String(ev?.next_earnings_date || '').match(/^(\d{2})\/(\d{2})\/(\d{4})(\(est\))?/)
  if (!m) return null
  const timing = ev.announce_time === 'A' ? 'after' : ev.announce_time === 'B' ? 'before' : null
  return { date: `${m[3]}-${m[1]}-${m[2]}`, confirmed: !m[4], timing }
}

// ---- Batched quotes: CNBC first (40 symbols per request), Stooq per-symbol fallback.
// extended: also name, security type, intraday high/low, P/E and next earnings date.
export async function fetchQuotes(tickers, { extended = false } = {}) {
  const out = {}
  if (!tickers.length) return out
  const chunks = []
  for (let i = 0; i < tickers.length; i += 40) chunks.push(tickers.slice(i, i + 40))
  const method = extended ? 'extended&events=1' : 'itv'
  // Up to 6 requests at a time — the strategy scan quotes ~1,500 names.
  for (let i = 0; i < chunks.length; i += 6) {
    await Promise.all(
      chunks.slice(i, i + 6).map(async (chunk) => {
        try {
          const symbols = chunk.map(cnbcSym).join('|')
          const url = `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(symbols)}&requestMethod=${method}&noform=1&partnerId=2&output=json`
          const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) })
          if (!res.ok) return
          const data = await res.json()
          let quotes = data?.FormattedQuoteResult?.FormattedQuote || []
          if (!Array.isArray(quotes)) quotes = [quotes]
          for (const q of quotes) {
            const ticker = String(q.symbol || '').replace(/\./g, '-')
            const price = num(q.last)
            if (!ticker || !price) continue
            out[ticker] = {
              price,
              dayChgPct: num(q.change_pct) ?? 0,
              prevClose: num(q.previous_day_closing) ?? price,
              ...(extended
                ? {
                    name: q.name || null,
                    secType: q.subType || null,
                    low: num(q.low) || null,
                    high: num(q.high) || null,
                    pe: num(q.pe),
                    fpe: num(q.fpe),
                    earnings: parseEarnings(q.EventData),
                  }
                : {}),
            }
          }
        } catch {
          /* fall through to Stooq */
        }
      })
    )
  }
  // Per-symbol fallback only for a handful — a CNBC outage must not fan out
  // into a thousand Stooq requests.
  const missing = tickers.filter((t) => !out[t])
  if (missing.length <= 40) {
    await Promise.all(
      missing.map(async (t) => {
        const q = await stooqQuote(t)
        if (q) out[t] = q
      })
    )
  }
  return out
}

export async function fetchQuote(ticker) {
  const quotes = await fetchQuotes([ticker])
  return quotes[ticker] || null
}

// A symbol that isn't in the universe but does trade (CNBC knows it), so
// clients can analyze any ticker. Returns a universe-shaped entry or null.
export async function resolveTicker(ticker) {
  const t = String(ticker || '').trim().toUpperCase().replace('.', '-')
  if (!/^[A-Z][A-Z0-9]{0,5}(-[A-Z])?$/.test(t)) return null
  const q = (await fetchQuotes([t], { extended: true }))[t]
  if (!q?.name) return null
  return { t, n: q.name, ind: 'Other', type: q.secType === 'Exchange Traded Fund' ? 'etf' : 'stock', cap: null }
}

async function stooqQuote(ticker) {
  try {
    const res = await fetch(`https://stooq.com/q/l/?s=${ticker.toLowerCase()}.us&f=sd2t2ohlcv&h&e=csv`, { headers: UA })
    if (!res.ok) return null
    const lines = (await res.text()).trim().split('\n')
    if (lines.length < 2) return null
    const [, , , open, , , close] = lines[1].split(',')
    const price = parseFloat(close)
    const o = parseFloat(open)
    if (!isFinite(price) || price <= 0) return null
    return { price, dayChgPct: isFinite(o) && o > 0 ? ((price - o) / o) * 100 : 0, prevClose: price }
  } catch {
    return null
  }
}

// ---- Daily history → compact chart stats for Kian Quant (CNBC, keyless).
export async function fetchStats(ticker) {
  try {
    const res = await fetch(`https://ts-api.cnbc.com/harmony/app/charts/3M.json?symbol=${encodeURIComponent(cnbcSym(ticker))}`, { headers: UA })
    if (!res.ok) return null
    const data = await res.json()
    const bars = data?.barData?.priceBars || []
    const closes = bars.map((b) => parseFloat(b.close)).filter((v) => isFinite(v))
    if (closes.length < 21) return null
    const recent = closes.slice(-60)
    const last = recent[recent.length - 1]
    const ago = (n) => recent[recent.length - 1 - n]
    const hi = Math.max(...recent)
    return {
      price: last,
      chg5dPct: +(((last - ago(5)) / ago(5)) * 100).toFixed(1),
      chg20dPct: +(((last - ago(20)) / ago(20)) * 100).toFixed(1),
      pctFrom60dHigh: +(((last - hi) / hi) * 100).toFixed(1),
    }
  } catch {
    return null
  }
}

// ---- ~2 years of daily bars (CNBC "1Y" chart, keyless), oldest first: [{ t, c, v }].
export async function fetchDailyBars(ticker) {
  try {
    const res = await fetch(`https://ts-api.cnbc.com/harmony/app/charts/1Y.json?symbol=${encodeURIComponent(cnbcSym(ticker))}`, {
      headers: UA,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.barData?.priceBars || [])
      .map((b) => {
        const s = String(b.tradeTime)
        return { t: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`, c: parseFloat(b.close), v: Number(b.volume) || 0 }
      })
      .filter((b) => isFinite(b.c) && b.c > 0)
  } catch {
    return []
  }
}

// ---- Past earnings report dates (Nasdaq, keyless), newest first.
export async function fetchPastEarningsDates(ticker) {
  try {
    const res = await fetch(`https://api.nasdaq.com/api/company/${encodeURIComponent(cnbcSym(ticker))}/earnings-surprise`, {
      headers: { ...UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.data?.earningsSurpriseTable?.rows || [])
      .map((r) => String(r.dateReported || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))
      .filter(Boolean)
      .map((m) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`)
      .sort()
      .reverse()
  } catch {
    return []
  }
}
