// ---- Fake but good-looking portfolio data ----

export const PORTFOLIO_VALUE = 184920.47

// Seeded random-walk generator so each period has its own detailed shape.
function gen(points, totalDriftPct, vol, seed) {
  let v = 100
  let s = seed
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const drift = totalDriftPct / 100 / points
  const out = []
  for (let i = 0; i < points; i++) {
    v = v * (1 + drift + (rand() - 0.5) * vol)
    out.push(v)
  }
  return out
}

// A distinct, more-or-less detailed series per period.
export const SERIES_BY_PERIOD = {
  '1D': gen(48, 1.84, 0.0045, 11),
  '1W': gen(74, 4.62, 0.0062, 27),
  '1M': gen(120, 12.37, 0.0072, 39),
  '1Y': gen(240, 38.4, 0.0105, 53),
  Max: gen(320, 121.6, 0.0125, 71),
}

export const PERIODS = ['1D', '1W', '1M', '1Y', 'Max']

export const PERIOD_CHANGE = {
  '1D': 1.84,
  '1W': 4.62,
  '1M': 12.37,
  '1Y': 38.4,
  Max: 121.6,
}

export const PERIOD_LABEL = {
  '1D': 'Today',
  '1W': 'This week',
  '1M': 'This month',
  '1Y': 'This year',
  Max: 'All time',
}

export const PERFORMANCE = {
  daily: 1.84,
  weekly: 4.62,
  monthly: 12.37,
}

// ---- Allocation pie data ----
export const ASSET_CLASS = [
  { label: 'Stocks', value: 62, color: '#101012' },
  { label: 'ETFs', value: 28, color: '#06c167' },
  { label: 'Crypto', value: 7, color: '#0b5cff' },
  { label: 'Cash', value: 3, color: '#c4c4c8' },
]

export const INDUSTRY = [
  { label: 'Technology', value: 34, color: '#101012' },
  { label: 'Aerospace & Defence', value: 21, color: '#06c167' },
  { label: 'Financials', value: 15, color: '#0b5cff' },
  { label: 'Healthcare', value: 12, color: '#7d3cff' },
  { label: 'Consumer', value: 10, color: '#ff9900' },
  { label: 'Energy', value: 8, color: '#c4c4c8' },
]
