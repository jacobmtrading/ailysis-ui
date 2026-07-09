export default function PositionsOverlay({ open, title, positions = [], onClose }) {
  if (!open) return null
  return (
    <div className="pos-overlay">
      <header className="pos-header">
        <button className="pos-back" onClick={onClose} aria-label="Back">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="pos-header-info">
          <div className="pos-header-title">Positions</div>
          <div className="pos-header-sub">{title}</div>
        </div>
      </header>

      <div className="pos-list">
        {positions.length === 0 && <div className="empty-note">No positions yet — 100% cash.</div>}
        {positions.map((p, i) => {
          const up = p.change >= 0
          return (
            <div className="pos-row" key={i}>
              <div className={`order-badge badge-${p.badge}`}>{p.ticker.slice(0, 4)}</div>
              <div className="pos-main">
                <div className="pos-name">{p.name}</div>
                <div className="pos-sub">
                  {p.ticker}
                  {p.weight != null ? ` · ${p.weight.toFixed(1)}% of portfolio` : ''}
                </div>
              </div>
              <div className={`pos-pl ${up ? 'up' : 'down'}`}>
                {up ? '▲' : '▼'} {Math.abs(p.change).toFixed(2)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
