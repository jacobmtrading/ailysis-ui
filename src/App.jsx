import { useState } from 'react'
import Intro from './components/Intro'
import LineChart from './components/LineChart'
import PieChart from './components/PieChart'
import ChatOverlay from './components/ChatOverlay'
import PositionsOverlay from './components/PositionsOverlay'
import { useMarketStatus } from './useMarketStatus'
import {
  SERIES_BY_PERIOD,
  PERIODS,
  PERIOD_CHANGE,
  PERIOD_LABEL,
  ASSET_CLASS,
  INDUSTRY,
} from './data/portfolio'
import { ORDERS } from './data/orders'
import { POSITIONS } from './data/positions'

const TOP_POSITIONS = [...POSITIONS].sort((a, b) => b.weight - a.weight).slice(0, 4)

const fmtMoney2 = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const fmtPct = (n) => `${Math.abs(n).toFixed(2)}%`

const ORDER_DATES = {
  nvda: 'Jul 6',
  pltr: 'Jul 2',
  cost: 'Jun 28',
  xom: 'Jun 21',
  vti: 'Jun 15',
  lly: 'Jun 9',
  amd: 'Jul 4',
  tsla: 'Jul 1',
  googl: 'Jun 25',
  asml: 'Jun 18',
}
// Map the perf periods that also live on the chip row.
const PERIOD_FOR = { Day: '1D', Week: '1W', Month: '1M' }

function MarketPill() {
  const m = useMarketStatus()
  return (
    <div className="market-pill">
      <span className={`market-dot ${m.open ? 'open' : 'closed'}`} />
      {m.open ? (
        <span>
          Market open · closes in <b>{m.label}</b>
        </span>
      ) : (
        <span>
          Market closed · opens in <b>{m.label}</b>
        </span>
      )}
    </div>
  )
}

function Perf({ label, period, active, onSelect }) {
  const value = PERIOD_CHANGE[period]
  const up = value >= 0
  return (
    <button className={`perf-cell ${active ? 'active' : ''}`} onClick={() => onSelect(period)}>
      <div className="perf-label">{label}</div>
      <div className={`perf-value ${up ? 'up' : 'down'}`}>
        {up ? '▲' : '▼'} {fmtPct(value)}
      </div>
    </button>
  )
}

function OrderRow({ order, i, onOpen }) {
  const up = order.pl >= 0
  return (
    <button className="order-row" onClick={() => onOpen(order)}>
      <div className={`order-badge badge-${i % 6}`}>{order.ticker.slice(0, 4)}</div>
      <div className="order-main">
        <div className="order-name">{order.name}</div>
        <div className="order-sub">
          <span className="buy-tag">BUY</span> {ORDER_DATES[order.id]} · {order.qty} @ {fmtMoney2(order.price)}
        </div>
      </div>
      <div className="order-nums">
        <div className="order-pl-label">P/L</div>
        <div className={`order-pl ${up ? 'up' : 'down'}`}>
          {up ? '+' : ''}
          {order.pl.toFixed(1)}%
        </div>
      </div>
    </button>
  )
}

export default function App() {
  const [introDone, setIntroDone] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)
  const [positions, setPositions] = useState(null) // holds the title when open
  const [period, setPeriod] = useState('1W')

  const change = PERIOD_CHANGE[period]
  const changeUp = change >= 0

  return (
    <div className="app">
      {!introDone && <Intro onDone={() => setIntroDone(true)} />}

      <div className="pager">
        {/* ---- Screen 1: portfolio + chart ---- */}
        <section className="page page-portfolio">
          <MarketPill />

          <div className="tr-header">
            <div className="tr-titlewrap">
              <span className="tr-title">Portfolio</span>
              <span className="tr-by">by Ailysis</span>
            </div>
          </div>

          <div className="tr-valblock">
            <div className={`portfolio-perf ${changeUp ? 'up' : 'down'}`}>
              {changeUp ? '+' : '−'}{fmtPct(change)}
            </div>
            <div className="tr-change-sub">{PERIOD_LABEL[period]}</div>
          </div>

          <div className="tr-periods">
            {PERIODS.map((p) => (
              <button
                key={p}
                className={`tr-period ${period === p ? 'active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="chart-area">
            <LineChart data={SERIES_BY_PERIOD[period]} />
          </div>

          <div className="perf-row">
            {['Day', 'Week', 'Month'].map((lbl) => (
              <Perf
                key={lbl}
                label={lbl}
                period={PERIOD_FOR[lbl]}
                active={period === PERIOD_FOR[lbl]}
                onSelect={setPeriod}
              />
            ))}
          </div>

          <div className="swipe-hint">
            <span>Order history</span>
            <span className="chev">⌄</span>
          </div>
        </section>

        {/* ---- Screen 2: order history only ---- */}
        <section className="page page-orders">
          <div className="tr-header">
            <div className="tr-title">Order history</div>
          </div>

          <div className="order-list">
            {ORDERS.slice(0, 8).map((o, i) => (
              <OrderRow key={o.id} order={o} i={i} onOpen={setActiveOrder} />
            ))}
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
            <PieChart title="Industry" data={INDUSTRY} onClick={() => setPositions('By industry')} />
            <PieChart title="Asset class" data={ASSET_CLASS} onClick={() => setPositions('By asset class')} />
          </div>

          <div className="top-head">
            <span>Biggest positions</span>
            <button className="top-seeall" onClick={() => setPositions('All holdings')}>
              See all ›
            </button>
          </div>

          <div className="top-list">
            {TOP_POSITIONS.map((p, i) => {
              const up = p.change >= 0
              return (
                <button className="top-row" key={i} onClick={() => setPositions('All holdings')}>
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
            })}
          </div>
        </section>
      </div>

      <PositionsOverlay open={!!positions} title={positions} onClose={() => setPositions(null)} />
      <ChatOverlay order={activeOrder} onClose={() => setActiveOrder(null)} />
    </div>
  )
}
