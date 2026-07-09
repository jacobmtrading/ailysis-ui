// Fetches live state from the backend and reshapes it for the UI.
// Returns null when the backend isn't live yet (UI falls back to demo data).

const PALETTE = ['#101012', '#06c167', '#0b5cff', '#7d3cff', '#ff9900', '#c4c4c8', '#5b6167']

const badgeFor = (ticker) => {
  let h = 0
  for (const c of String(ticker)) h = (h * 31 + c.charCodeAt(0)) % 997
  return h % 6
}

const dateLabel = (t) =>
  new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function periodSlices(series) {
  const now = Date.now()
  const windows = {
    '1D': 26 * 3600e3, // generous "day" window so overnight gaps still show a line
    '1W': 7 * 86400e3,
    '1M': 30 * 86400e3,
    '1Y': 365 * 86400e3,
    Max: Infinity,
  }
  const seriesByPeriod = {}
  const periodChange = {}
  for (const [key, span] of Object.entries(windows)) {
    let pts = series.filter((p) => now - p.t <= span).map((p) => p.v)
    if (!pts.length) pts = series.length ? [series[series.length - 1].v] : [100000]
    if (pts.length === 1) pts = [pts[0], pts[0]]
    seriesByPeriod[key] = pts
    periodChange[key] = +(((pts[pts.length - 1] - pts[0]) / pts[0]) * 100).toFixed(2)
  }
  return { seriesByPeriod, periodChange }
}

function buildPies(state) {
  const industries = Object.entries(state.industryWeights || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const cashPct = state.classSplit?.cashPct ?? 0
  const industryPie = industries.map(([label, value], i) => ({ label, value: Math.round(value), color: PALETTE[i % PALETTE.length] }))
  if (cashPct >= 1) industryPie.push({ label: 'Cash', value: Math.round(cashPct), color: '#e3e3e6' })

  const assetPie = [
    { label: 'Stocks', value: Math.round(state.classSplit?.stocksPct ?? 0), color: '#101012' },
    { label: 'ETFs', value: Math.round(state.classSplit?.etfsPct ?? 0), color: '#06c167' },
    { label: 'Cash', value: Math.round(cashPct), color: '#c4c4c8' },
  ].filter((s) => s.value >= 1)
  return { industryPie, assetPie }
}

export async function fetchLive() {
  try {
    const res = await fetch('/api/state', { cache: 'no-store' })
    if (!res.ok) return null
    const state = await res.json()
    if (!state.live) return null

    const { seriesByPeriod, periodChange } = periodSlices(state.series || [])
    const { industryPie, assetPie } = buildPies(state)

    const orders = (state.orders || []).map((o) => {
      const chatObj = state.chats?.[o.chatId]
      return {
        id: o.id,
        ticker: o.ticker,
        name: o.name,
        side: o.side,
        qty: o.qty,
        price: o.price,
        pl: o.plPct ?? 0,
        timeLabel: dateLabel(o.time),
        source: chatObj?.source || '',
        chat: chatObj?.messages || null,
      }
    })

    const positions = (state.positions || []).map((p) => ({
      name: p.name,
      ticker: p.ticker,
      change: p.plPct,
      weight: p.weightPct,
      badge: badgeFor(p.ticker),
    }))

    return {
      live: true,
      value: state.value,
      seriesByPeriod,
      periodChange,
      orders,
      positions,
      industryPie,
      assetPie,
      hasHistory: (state.series || []).length >= 2,
    }
  } catch {
    return null
  }
}
