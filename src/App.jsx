import { useState } from 'react'
import Intro from './components/Intro'
import LineChart from './components/LineChart'
import PieChart from './components/PieChart'
import ChatOverlay from './components/ChatOverlay'
import { useMarketStatus } from './useMarketStatus'
import {
  SERIES,
  PORTFOLIO_VALUE,
  PERFORMANCE,
  ASSET_CLASS,
  INDUSTRY,
} from './data/portfolio'
import { ORDERS } from './data/orders'

function fmtMoney(n) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function Perf({ label, value }) {
  const up = value >= 0
  return (
    <div className="perf-cell">
      <div className="perf-label">{label}</div>
      <div className={`perf-value ${up ? 'up' : 'down'}`}>
        {up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
      </div>
    </div>
  )
}

function MarketBar() {
  const m = useMarketStatus()
  return (
    <div className={`market-bar ${m.open ? 'open' : 'closed'}`}>
      <span className="market-dot" />
      {m.open ? (
        <span>
          Market <b>open</b> · closes in <b>{m.label}</b>
        </span>
      ) : (
        <span>
          Market <b>closed</b> · opens in <b>{m.label}</b>
        </span>
      )}
    </div>
  )
}

function OrderRow({ order, onOpen }) {
  const up = order.pl >= 0
  return (
    <button className="order-row" onClick={() => onOpen(order)}>
      <div className="order-badge">{order.ticker.slice(0, 4)}</div>
      <div className="order-main">
        <div className="order-name">{order.name}</div>
        <div className="order-ticker">{order.ticker}</div>
      </div>
      <div className="order-price">{fmtMoney(order.price)}</div>
      <div className="order-qty">×{order.qty}</div>
      <div className={`order-pl ${up ? 'up' : 'down'}`}>
        {up ? '+' : ''}
        {order.pl.toFixed(1)}%
      </div>
    </button>
  )
}

export default function App() {
  const [introDone, setIntroDone] = useState(false)
  const [activeOrder, setActiveOrder] = useState(null)

  return (
    <div className="app">
      {!introDone && <Intro onDone={() => setIntroDone(true)} />}

      <div className="pager">
        {/* ---- Screen 1: portfolio ---- */}
        <section className="page page-portfolio">
          <MarketBar />

          <div className="portfolio-head">
            <div className="portfolio-brand">ailysis</div>
            <div className="portfolio-value">{fmtMoney(PORTFOLIO_VALUE)}</div>
            <div className="portfolio-sub">
              <span className="up">▲ {fmtMoney(PORTFOLIO_VALUE * PERFORMANCE.daily / 100)}</span> today
            </div>
          </div>

          <div className="chart-area">
            <LineChart data={SERIES} />
          </div>

          <div className="perf-row">
            <Perf label="Daily" value={PERFORMANCE.daily} />
            <Perf label="Weekly" value={PERFORMANCE.weekly} />
            <Perf label="Monthly" value={PERFORMANCE.monthly} />
          </div>

          <div className="swipe-hint">
            <span>Orders & allocation</span>
            <span className="chev">⌄</span>
          </div>
        </section>

        {/* ---- Screen 2: orders + allocation ---- */}
        <section className="page page-orders">
          <h2 className="section-title">Order History</h2>
          <div className="order-list">
            {ORDERS.map((o) => (
              <OrderRow key={o.id} order={o} onOpen={setActiveOrder} />
            ))}
          </div>

          <div className="pies">
            <PieChart title="Industry" data={INDUSTRY} />
            <PieChart title="Asset Class" data={ASSET_CLASS} />
          </div>
        </section>
      </div>

      <ChatOverlay order={activeOrder} onClose={() => setActiveOrder(null)} />
    </div>
  )
}
