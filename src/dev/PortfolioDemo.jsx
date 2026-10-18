// Dev-only harness: open http://localhost:5173/?demo=portfolio to try the
// portfolio chart (and its index compare picker) with a synthetic fund and
// synthetic index history — no login, no Redis, no CNBC.
// Only reachable in `vite dev` — main.jsx guards it.
import PortfolioView from '../components/PortfolioView'

const HOUR = 3600e3
const now = Date.now()

// Deterministic random walk: n points, one every stepMs, ending now.
function walk(n, stepMs, start, drift, vol, seed) {
  let s = seed
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5
  let v = start
  return Array.from({ length: n }, (_, i) => {
    v *= 1 + drift + vol * rand()
    return [now - (n - 1 - i) * stepMs, +v.toFixed(2)]
  })
}

const series = walk(24 * 60, HOUR, 100000, 0.00008, 0.006, 7).map(([t, v]) => ({ t, v }))
const BENCH = {
  sp500: walk(24 * 90, HOUR, 6800, 0.00005, 0.003, 11),
  dax: walk(24 * 90, HOUR, 23000, 0.00004, 0.0035, 23),
  msci: walk(24 * 90, HOUR, 4300, 0.00004, 0.0025, 41),
}

const realFetch = window.fetch
window.fetch = (url, opts) => {
  if (String(url).startsWith('/api/state')) {
    return Promise.resolve(
      new Response(JSON.stringify({ live: true, value: series[series.length - 1].v, series, positions: [], orders: [], chats: {}, classSplit: { cashPct: 100 }, industryWeights: {} }))
    )
  }
  if (String(url).startsWith('/api/benchmarks')) {
    return new Promise((r) => setTimeout(() => r(new Response(JSON.stringify(BENCH))), 400))
  }
  return realFetch(url, opts)
}

export default function PortfolioDemo() {
  return <PortfolioView open onClose={() => {}} onOpenChat={() => {}} />
}
