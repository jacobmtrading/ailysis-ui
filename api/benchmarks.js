// GET /api/benchmarks — index history the portfolio chart can be compared
// against: S&P 500, DAX and MSCI World. Free, keyless CNBC chart data —
// ~2 years of daily closes, with the last 5 days replaced by intraday bars.
// Cached at the edge for 15 minutes; one call serves every visitor.

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' }

// closeHours: daily bars are stamped at midnight New York time — shift them
// to the session close so they line up with the hourly portfolio points.
const INDICES = {
  sp500: { symbol: '.SPX', closeHours: 16 },
  dax: { symbol: '.GDAXI', closeHours: 11.5 },
  msci: { symbol: '.MIWO00000PUS', closeHours: 16 },
}

async function bars(symbol, range) {
  try {
    const res = await fetch(`https://ts-api.cnbc.com/harmony/app/charts/${range}.json?symbol=${encodeURIComponent(symbol)}`, {
      headers: UA,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.barData?.priceBars || [])
      .map((b) => ({ t: Number(b.tradeTimeinMills), v: parseFloat(b.close) }))
      .filter((b) => b.t > 0 && isFinite(b.v) && b.v > 0)
  } catch {
    return []
  }
}

async function history({ symbol, closeHours }) {
  const [daily, intraday] = await Promise.all([bars(symbol, '1Y'), bars(symbol, '5D')])
  const shifted = daily.map((b) => ({ t: b.t + closeHours * 3600e3, v: b.v }))
  const cutoff = intraday.length ? intraday[0].t : Infinity
  return [...shifted.filter((b) => b.t < cutoff), ...intraday].map((b) => [b.t, +b.v.toFixed(2)])
}

export default async function handler(req, res) {
  const keys = Object.keys(INDICES)
  const series = await Promise.all(keys.map((k) => history(INDICES[k])))
  const body = Object.fromEntries(keys.map((k, i) => [k, series[i]]))
  const ok = series.some((s) => s.length)
  res.setHeader('Cache-Control', ok ? 'public, s-maxage=900, stale-while-revalidate=3600' : 'no-store')
  res.status(ok ? 200 : 502).json(body)
}
