import { POSITIONS } from '../data/positions'

const fmtPct = (n) => `${Math.abs(n).toFixed(2)}%`

export default function PositionsOverlay({ open, title, onClose }) {
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
        {POSITIONS.map((p, i) => {
          const up = p.change >= 0
          return (
            <div className="pos-row" key={i}>
              <div className={`order-badge badge-${p.badge}`}>{p.ticker.slice(0, 4)}</div>
              <div className="pos-main">
                <div className="pos-name">{p.name}</div>
                <div className="pos-sub">{p.ticker}</div>
              </div>
              <div className={`pos-pl ${up ? 'up' : 'down'}`}>
                {up ? '▲' : '▼'} {fmtPct(p.change)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
