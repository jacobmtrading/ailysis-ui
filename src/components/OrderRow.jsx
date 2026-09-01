const fmtMoney2 = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const SIDE_META = {
  buy: { tag: 'BUY', cls: 'buy-tag' },
  sell: { tag: 'SELL', cls: 'sell-tag' },
  pass: { tag: 'PASS', cls: 'pass-tag' },
  review: { tag: 'REVIEW', cls: 'pass-tag' },
}

function badgeOf(order) {
  if (typeof order.badge === 'number') return order.badge
  let h = 0
  for (const c of order.ticker) h = (h * 31 + c.charCodeAt(0)) % 997
  return h % 6
}

export default function OrderRow({ order, onOpen }) {
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
