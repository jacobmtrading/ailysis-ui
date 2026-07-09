import { useEffect, useMemo, useState } from 'react'
import Intro from './components/Intro'
import LineChart from './components/LineChart'
import PieChart from './components/PieChart'
import ChatOverlay from './components/ChatOverlay'
import PositionsOverlay from './components/PositionsOverlay'
import { useMarketStatus } from './useMarketStatus'
import { fetchLive } from './api'
import { PERIODS, PERIOD_LABEL } from './data/portfolio'

const fmtMoney2 = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
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
      {m.open ? (
        <span>
          {m.label2 || 'Market'} <b>open</b> · closes in <b>{m.label}</b>
        </span>
      ) : (
        <span>
          Markets <b>closed</b> · opens in <b>{m.label}</b>
        </span>
      )}
    </div>
  )
}

const SIDE_META = {
  buy: { tag: 'BUY', cls: 'buy-tag' },
  sell: { tag: 'SELL', cls: 'sell-tag' },
  pass: { tag: 'PASS', cls: 'pass-tag' },
  review: { tag: 'REVIEW', cls: 'pass-tag' },
}

function OrderRow({ order, onOpen }) {
  const meta = SIDE_META[order.side] || SIDE_META.buy
  const hasPl = order.side === 'buy' || order.side === 'sell'
  const up = order.pl >= 0
  const sub =
    order.side === 'pass'
      ? `${order.timeLabel} · board passed`
      : order.side === 'review'
        ? `${order.timeLabel} · daily check`
        : `${order.timeLabel} · ${order.qty} @ ${fmtMoney2(order.price)}`
  return (
    <button className="order-row" onClick={() => order.chat && onOpen(order)}>
      <div className={`order-badge badge-${badgeOf(order)}`}>{order.ticker.slice(0, 4)}</div>
      <div className="order-main">
        <div className="order-name">{order.name}</div>
        <div className="order-sub">
          <span className={meta.cls}>{meta.tag}</span> {sub}
        </div>
      </div>
      <div className="order-nums">
        <div className="order-pl-label">{hasPl ? 'P/L' : ''}</div>
        <div className={`order-pl ${up ? 'up' : 'down'}`}>
          {hasPl ? `${up ? '+' : ''}${order.pl.toFixed(1)}%` : '—'}
        </div>
      </div>
    </button>
  )
}

function badgeOf(order) {
  if (typeof order.badge === 'number') return order.badge
  let h = 0
  for (const c of order.ticker) h = (h * 31 + c.charCodeAt(0)) % 997
  return h % 6
}

export default function App() {
  const [introDone, setIntroDone] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)
  const [positionsOpen, setPositionsOpen] = useState(null)
  const [period, setPeriod] = useState('1W')
  const [live, setLive] = useState(null)

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
          <MarketPill />

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
          <div className="tr-header">
            <div className="tr-title">Order history</div>
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

      <PositionsOverlay open={!!positionsOpen} title={positionsOpen} positions={data.positions} onClose={() => setPositionsOpen(null)} />
      <ChatOverlay order={activeOrder} onClose={() => setActiveOrder(null)} />
    </div>
  )
}
