// Chart period configuration (used by the live UI).
export const PERIODS = ['1D', '1W', '1M', '1Y', 'Max']

export const PERIOD_LABEL = {
  '1D': 'Today',
  '1W': 'This week',
  '1M': 'This month',
  '1Y': 'This year',
  Max: 'All time',
}

// Indices the chart can be compared against (keys match /api/benchmarks).
export const BENCHMARKS = [
  { key: 'sp500', label: 'S&P 500', color: '#4c8dff' },
  { key: 'dax', label: 'DAX', color: '#ff9f0a' },
  { key: 'msci', label: 'MSCI World', color: '#bf5af2' },
]
