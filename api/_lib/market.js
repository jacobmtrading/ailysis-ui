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

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' }

const cnbcSym = (t) => t.replace(/-/g, '.') // BRK-B -> BRK.B
const num = (s) => {
  const v = parseFloat(String(s).replace(/[%,]/g, ''))
  return isFinite(v) ? v : null
}

// ---- Batched quotes: CNBC first (1 request for up to ~40 symbols), Stooq per-symbol fallback.
export async function fetchQuotes(tickers) {
  const out = {}
  if (!tickers.length) return out
  try {
    for (let i = 0; i < tickers.length; i += 40) {
      const chunk = tickers.slice(i, i + 40)
      const symbols = chunk.map(cnbcSym).join('|')
      const url = `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(symbols)}&requestMethod=itv&noform=1&partnerId=2&output=json`
      const res = await fetch(url, { headers: UA })
      if (!res.ok) continue
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
        }
      }
    }
  } catch {
    /* fall through to Stooq */
  }
  const missing = tickers.filter((t) => !out[t])
  await Promise.all(
    missing.map(async (t) => {
      const q = await stooqQuote(t)
      if (q) out[t] = q
    })
  )
  return out
}

export async function fetchQuote(ticker) {
  const quotes = await fetchQuotes([ticker])
  return quotes[ticker] || null
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
