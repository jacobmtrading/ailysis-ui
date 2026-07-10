import OrderRow from './OrderRow'

// Full, scrollable history of every board discussion (buys, sells, passes,
// daily reviews). Tapping one opens its chat.
export default function AllDiscussionsOverlay({ open, orders = [], onOpen, onClose }) {
  if (!open) return null
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
          <div className="pos-header-sub">{orders.length} board decisions</div>
        </div>
      </header>

      <div className="all-list">
        {orders.length === 0 && <div className="empty-note">No discussions yet.</div>}
        {orders.map((o) => (
          <OrderRow key={o.id} order={o} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}
