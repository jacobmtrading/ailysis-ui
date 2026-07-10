import { useEffect, useMemo, useState } from 'react'
import Intro from './components/Intro'
import LineChart from './components/LineChart'
import PieChart from './components/PieChart'
import ChatOverlay from './components/ChatOverlay'
import PositionsOverlay from './components/PositionsOverlay'
import OrderRow from './components/OrderRow'
import TutorialOverlay from './components/TutorialOverlay'
import AboutOverlay from './components/AboutOverlay'
import AllDiscussionsOverlay from './components/AllDiscussionsOverlay'
import { useMarketStatus } from './useMarketStatus'
import { fetchLive } from './api'
import { PERIODS, PERIOD_LABEL } from './data/portfolio'

const fmtPct = (n) => `${Math.abs(n).toFixed(2)}%`
const PERIOD_FOR = { Day: '1D', Week: '1W', Month: '1M' }

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

function MarketPill() {
  const m = useMarketStatus()
  return (
    <div className="market-pill">
      <span className={`market-dot ${m.open ? 'open' : 'closed'}`} />
      <span>
        {m.open ? 'Open' : 'Closed'} · <b>{m.label}</b>
      </span>
    </div>
  )
}

export default function App() {
  const [introDone, setIntroDone] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)
  const [positionsOpen, setPositionsOpen] = useState(null)
  const [period, setPeriod] = useState('1W')
  const [live, setLive] = useState(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    const refresh = () => fetchLive().then((d) => mounted && d && setLive(d))
    refresh()
    const id = setInterval(refresh, 5 * 60000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  const data = live || EMPTY
  const change = data.periodChange[period] ?? 0
  const changeUp = change >= 0
  const chartData = data.seriesByPeriod[period] || [100, 100]
  const topPositions = useMemo(() => data.positions.slice(0, 3), [data])

  return (
    <div className="app">
      {!introDone && <Intro onDone={() => setIntroDone(true)} />}

      <div className="pager">
        {/* ---- Screen 1: portfolio + chart ---- */}
        <section className="page page-portfolio">
          <div className="top-bar">
            <button className="logo-btn" onClick={() => setAboutOpen(true)} aria-label="About Ailysis">
              <img src="/logo-mark.jpg" alt="Ailysis" />
            </button>
            <MarketPill />
            <button className="help-btn" onClick={() => setTutorialOpen(true)} aria-label="Open tutorial">
              ?
            </button>
          </div>

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
          </div>

          <div className="chart-area">
            <LineChart data={chartData} />
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
              data.orders.slice(0, 8).map((o) => <OrderRow key={o.id} order={o} onOpen={setActiveOrder} />)
            ) : (
              <div className="empty-note">No orders yet — the board is watching the market. 🤖</div>
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
      <AllDiscussionsOverlay open={allOpen} orders={data.orders} onOpen={setActiveOrder} onClose={() => setAllOpen(false)} />
      <TutorialOverlay open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
      <AboutOverlay open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <ChatOverlay order={activeOrder} onClose={() => setActiveOrder(null)} />
    </div>
  )
}
