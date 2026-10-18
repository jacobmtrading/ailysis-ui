import { useEffect, useMemo, useState } from 'react'
import LineChart from './LineChart'
import PieChart from './PieChart'
import PositionsOverlay from './PositionsOverlay'
import OrderRow from './OrderRow'
import TutorialOverlay from './TutorialOverlay'
import WhatsNew from './WhatsNew'
import AllDiscussionsOverlay from './AllDiscussionsOverlay'
import MarketPill from './MarketPill'
import CompareMenu from './CompareMenu'
import { fetchLive, fetchBenchmarks } from '../api'
import { PERIODS, PERIOD_LABEL, BENCHMARKS } from '../data/portfolio'

const fmtPct = (n) => `${Math.abs(n).toFixed(2)}%`
const PERIOD_FOR = { Day: '1D', Week: '1W', Month: '1M' }
const COMPARE_KEY = 'ailysis.compare'

// Time grid for the empty state, which has values but no timestamps.
const FALLBACK_SPAN = { '1D': 26 * 3600e3, '1W': 7 * 86400e3, '1M': 30 * 86400e3, '1Y': 365 * 86400e3, Max: 365 * 86400e3 }

function loadCompare() {
  try {
    const keys = JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]')
    return BENCHMARKS.map((b) => b.key).filter((k) => keys.includes(k))
  } catch {
    return []
  }
}

// Last index close at or before t (first close if t predates the history).
function closeAt(history, t) {
  let lo = 0
  let hi = history.length - 1
  if (t <= history[0][0]) return history[0][1]
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (history[mid][0] <= t) lo = mid
    else hi = mid - 1
  }
  return history[lo][1]
}

// A sparse portfolio series (new fund, quiet week) is stretched onto an even
// time grid so the index lines still show their shape.
function compareGrid(values, times) {
  if (times.length >= 40) return { values, times }
  const t0 = times[0]
  const t1 = times[times.length - 1]
  const n = 60
  const grid = Array.from({ length: n }, (_, i) => t0 + ((t1 - t0) * i) / (n - 1))
  let j = 0
  const held = grid.map((t) => {
    while (j < times.length - 1 && times[j + 1] <= t) j++
    return values[j]
  })
  return { values: held, times: grid }
}

// Clean empty state — shown while loading and until the board makes its
// first trade. No fake data.
const FLAT = [100000, 100000]
const CASH_PIE = [{ label: 'Cash', value: 100, color: '#c4c4c8' }]
const EMPTY = {
  live: false,
  seriesByPeriod: { '1D': FLAT, '1W': FLAT, '1M': FLAT, '1Y': FLAT, Max: FLAT },
  periodChange: { '1D': 0, '1W': 0, '1M': 0, '1Y': 0, Max: 0 },
  orders: [],
  positions: [],
  industryPie: CASH_PIE,
  assetPie: CASH_PIE,
}

// The AI fund: chart, order history and allocation as three vertically
// snapping screens. Members-only — opened from the landing carousel or menu.
export default function PortfolioView({ open, onClose, onOpenChat }) {
  const [positionsOpen, setPositionsOpen] = useState(null)
  const [period, setPeriod] = useState('1W')
  const [live, setLive] = useState(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)
  const [compare, setCompare] = useState(loadCompare)
  const [benchmarks, setBenchmarks] = useState(null)
  const [benchLoading, setBenchLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let mounted = true
    const refresh = () => fetchLive().then((d) => mounted && d && setLive(d))
    refresh()
    const id = setInterval(refresh, 5 * 60000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [open])

  const loadBenchmarks = () => {
    if (benchmarks || benchLoading) return
    setBenchLoading(true)
    fetchBenchmarks().then((d) => {
      setBenchmarks(d)
      setBenchLoading(false)
    })
  }

  // Saved picks from an earlier visit: fetch the index data straight away.
  useEffect(() => {
    if (open && compare.length) loadBenchmarks()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCompare = (key) => {
    loadBenchmarks()
    const next = compare.includes(key) ? compare.filter((k) => k !== key) : [...compare, key]
    setCompare(BENCHMARKS.map((b) => b.key).filter((k) => next.includes(k)))
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify(next))
    } catch {
      /* selection just won't be remembered */
    }
  }

  const data = live || EMPTY
  const change = data.periodChange[period] ?? 0
  const changeUp = change >= 0
  const chartData = data.seriesByPeriod[period] || [100, 100]
  const topPositions = useMemo(() => data.positions.slice(0, 3), [data])

  // Each index rebased to the portfolio's starting value over the same window,
  // so the lines start together and the gap is the out/under-performance.
  const { plotData, compareLines, compareChanges } = useMemo(() => {
    const none = { plotData: chartData, compareLines: [], compareChanges: null }
    if (!benchmarks) return none
    let times = data.timesByPeriod?.[period]
    if (!times || times.length !== chartData.length) {
      const now = Date.now()
      times = [now - FALLBACK_SPAN[period], now]
    }
    const grid = compareGrid(chartData, times)
    const changes = {}
    const lines = []
    for (const b of BENCHMARKS) {
      const history = benchmarks[b.key]
      if (!history?.length) continue
      const base = closeAt(history, grid.times[0])
      const closes = grid.times.map((t) => closeAt(history, t))
      changes[b.key] = ((closes[closes.length - 1] - base) / base) * 100
      if (compare.includes(b.key)) {
        lines.push({ key: b.key, color: b.color, data: closes.map((c) => (c / base) * grid.values[0]) })
      }
    }
    return { plotData: lines.length ? grid.values : chartData, compareLines: lines, compareChanges: changes }
  }, [benchmarks, compare, chartData, data, period])

  if (!open) return null

  return (
    <div className="portfolio-view">
      <div className="pager">
        {/* ---- Screen 1: portfolio + chart ---- */}
        <section className="page page-portfolio">
          <div className="top-bar">
            <button className="help-btn" onClick={onClose} aria-label="Back to features">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <MarketPill />
            <button className="help-btn" onClick={() => setTutorialOpen(true)} aria-label="Open tutorial">
              ?
            </button>
          </div>

          <WhatsNew show />

          <div className="tr-header">
            <div className="tr-titlewrap">
              <span className="tr-title">Portfolio</span>
              <span className="tr-by">by Ailysis</span>
            </div>
          </div>

          <div className="tr-valblock">
            <div className={`portfolio-perf ${changeUp ? 'up' : 'down'}`}>
              {changeUp ? '+' : '−'}
              {fmtPct(change)}
            </div>
            <div className="tr-change-sub">{PERIOD_LABEL[period]}</div>
          </div>

          <div className="tr-periods">
            {PERIODS.map((p) => (
              <button key={p} className={`tr-period ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                {p}
              </button>
            ))}
            <CompareMenu selected={compare} onToggle={toggleCompare} changes={compareChanges} onOpen={loadBenchmarks} />
          </div>

          <div className="chart-area">
            <LineChart data={plotData} compare={compareLines} />
            {compareLines.length > 0 && (
              <div className="chart-legend">
                <span>
                  <i style={{ background: '#fff' }} />
                  Portfolio
                </span>
                {compareLines.map((l) => (
                  <span key={l.key}>
                    <i style={{ background: l.color }} />
                    {BENCHMARKS.find((b) => b.key === l.key).label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="perf-row">
            {['Day', 'Week', 'Month'].map((lbl) => {
              const key = PERIOD_FOR[lbl]
              const v = data.periodChange[key] ?? 0
              return (
                <button key={lbl} className={`perf-cell ${period === key ? 'active' : ''}`} onClick={() => setPeriod(key)}>
                  <div className="perf-label">{lbl}</div>
                  <div className={`perf-value ${v >= 0 ? 'up' : 'down'}`}>
                    {v >= 0 ? '▲' : '▼'} {fmtPct(v)}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="swipe-hint">
            <span>Order history</span>
            <span className="chev">⌄</span>
          </div>
        </section>

        {/* ---- Screen 2: order history only ---- */}
        <section className="page page-orders">
          <div className="tr-header order-header">
            <div className="tr-title">Order history</div>
            <button className="top-seeall" onClick={() => setAllOpen(true)}>
              See all ›
            </button>
          </div>

          <div className="order-list">
            {data.orders.length ? (
              data.orders.slice(0, 8).map((o) => <OrderRow key={o.id} order={o} onOpen={onOpenChat} />)
            ) : (
              <div className="empty-note">No orders yet — the board is watching the market.</div>
            )}
          </div>

          <div className="swipe-hint">
            <span>Allocation</span>
            <span className="chev">⌄</span>
          </div>
        </section>

        {/* ---- Screen 3: allocation + biggest positions ---- */}
        <section className="page page-alloc">
          <div className="tr-header">
            <div className="tr-title">Allocation</div>
          </div>

          <div className="pies">
            <PieChart title="Industry" sub="sectors" data={data.industryPie} onClick={() => setPositionsOpen('By industry')} />
            <PieChart title="Asset class" sub="classes" data={data.assetPie} onClick={() => setPositionsOpen('By asset class')} />
          </div>

          <div className="top-head">
            <span>Biggest positions</span>
            <button className="top-seeall" onClick={() => setPositionsOpen('All holdings')}>
              See all ›
            </button>
          </div>

          <div className="top-list">
            {topPositions.length ? (
              topPositions.map((p, i) => {
                const up = p.change >= 0
                return (
                  <button className="top-row" key={i} onClick={() => setPositionsOpen('All holdings')}>
                    <div className={`order-badge badge-${p.badge}`}>{p.ticker.slice(0, 4)}</div>
                    <div className="top-main">
                      <div className="top-name">{p.name}</div>
                      <div className="top-sub">{p.weight.toFixed(1)}% of portfolio</div>
                    </div>
                    <div className={`top-change ${up ? 'up' : 'down'}`}>
                      {up ? '▲' : '▼'} {fmtPct(p.change)}
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="empty-note">No positions yet — 100% cash.</div>
            )}
          </div>
        </section>
      </div>

      <PositionsOverlay
        open={!!positionsOpen}
        title={positionsOpen}
        positions={data.positions}
        colorByType={positionsOpen === 'By asset class'}
        onClose={() => setPositionsOpen(null)}
      />
      <AllDiscussionsOverlay open={allOpen} orders={data.orders} onOpen={onOpenChat} onClose={() => setAllOpen(false)} />
      <TutorialOverlay open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  )
}
