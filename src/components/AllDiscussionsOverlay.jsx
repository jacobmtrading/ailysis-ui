import { useEffect, useState } from 'react'
import OrderRow from './OrderRow'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'buy', label: 'Buys' },
  { id: 'sell', label: 'Sells' },
]

// Full, scrollable history of every board discussion (buys, sells, passes,
// daily reviews). Tapping one opens its chat; the tabs narrow it to buy or sell orders.
export default function AllDiscussionsOverlay({ open, orders = [], onOpen, onClose }) {
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!open) setFilter('all')
  }, [open])

  if (!open) return null
  const shown = filter === 'all' ? orders : orders.filter((o) => o.side === filter)
  return (
    <div className="all-overlay">
      <header className="pos-header">
        <button className="pos-back" onClick={onClose} aria-label="Back">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="pos-header-info">
          <div className="pos-header-title">All discussions</div>
          <div className="pos-header-sub">
            {shown.length} {filter === 'all' ? 'board decision' : `${filter} order`}
            {shown.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      <div className="menu-tabs all-filters">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="all-list">
        {shown.length === 0 && (
          <div className="empty-note">{filter === 'all' ? 'No discussions yet.' : `No ${filter} orders yet.`}</div>
        )}
        {shown.map((o) => (
          <OrderRow key={o.id} order={o} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}
