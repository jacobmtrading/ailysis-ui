// ---- Fake but good-looking portfolio data ----

export const PORTFOLIO_VALUE = 184920.47
export const PERFORMANCE = {
  daily: 1.84,
  weekly: 4.62,
  monthly: 12.37,
}

// Monotonically-ish rising series (with realistic wobble) used for the hero chart.
// 90 points ~ last quarter.
function buildSeries() {
  const points = []
  let v = 100000
  let seed = 42
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let i = 0; i < 90; i++) {
    const drift = 0.0042 // ~ upward bias
    const noise = (rand() - 0.46) * 0.028
    v = v * (1 + drift + noise)
    points.push(v)
  }
  // make the very end match the headline number
  const scale = PORTFOLIO_VALUE / points[points.length - 1]
  return points.map((p) => p * scale)
}

export const SERIES = buildSeries()

// ---- Allocation pie data ----
export const ASSET_CLASS = [
  { label: 'Stocks', value: 62, color: '#00c46e' },
  { label: 'ETFs', value: 28, color: '#e6e6e6' },
  { label: 'Crypto', value: 7, color: '#6b7280' },
  { label: 'Cash', value: 3, color: '#33383f' },
]

export const INDUSTRY = [
  { label: 'Technology', value: 34, color: '#00c46e' },
  { label: 'Financials', value: 19, color: '#7fd8ad' },
  { label: 'Healthcare', value: 15, color: '#e6e6e6' },
  { label: 'Energy', value: 12, color: '#9aa0a6' },
  { label: 'Consumer', value: 11, color: '#5b6167' },
  { label: 'Industrials', value: 9, color: '#33383f' },
]
