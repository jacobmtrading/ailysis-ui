import { useMemo, useState } from 'react'

// Asset-class palette (matches the Asset class donut): stocks black, ETFs green.
const TYPE_COLOR = { stock: '#101012', etf: '#06c167' }

const SORTS = [
  { key: 'chgD', label: 'Day' },
  { key: 'chgW', label: 'Week' },
  { key: 'chgM', label: 'Month' },
]

export default function PositionsOverlay({ open, title, positions = [], colorByType = false, onClose }) {
  const [sortKey, setSortKey] = useState('chgD')

  const sorted = useMemo(() => {
    const val = (p) => (p[sortKey] == null ? -Infinity : p[sortKey])
    return [...positions].sort((a, b) => val(b) - val(a))
  }, [positions, sortKey])

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

      <div className="pos-toolbar">
        <div className="pos-sorts">
          <span className="pos-sort-label">Sort by</span>
          {SORTS.map((s) => (
            <button key={s.key} className={`pos-sort ${sortKey === s.key ? 'active' : ''}`} onClick={() => setSortKey(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        {colorByType && (
          <div className="pos-legend">
            <span className="pos-legend-item">
              <span className="pos-legend-dot" style={{ background: TYPE_COLOR.stock }} /> Stocks
            </span>
            <span className="pos-legend-item">
              <span className="pos-legend-dot" style={{ background: TYPE_COLOR.etf }} /> ETFs
            </span>
          </div>
        )}
      </div>

      <div className="pos-list">
        {sorted.length === 0 && <div className="empty-note">No positions yet — 100% cash.</div>}
        {sorted.map((p, i) => {
          const v = p[sortKey]
          const up = (v ?? 0) >= 0
          const badgeStyle = colorByType ? { background: TYPE_COLOR[p.type] || '#5b6167' } : undefined
          return (
            <div className="pos-row" key={i}>
              <div className={colorByType ? 'order-badge' : `order-badge badge-${p.badge}`} style={badgeStyle}>
                {p.ticker.slice(0, 4)}
              </div>
              <div className="pos-main">
                <div className="pos-name">{p.name}</div>
                <div className="pos-sub">
                  {p.ticker}
                  {p.type ? ` · ${p.type === 'etf' ? 'ETF' : 'Stock'}` : ''}
                  {p.weight != null ? ` · ${p.weight.toFixed(1)}%` : ''}
                </div>
              </div>
              <div className={`pos-pl ${up ? 'up' : 'down'}`}>
                {v == null ? '—' : `${up ? '▲' : '▼'} ${Math.abs(v).toFixed(2)}%`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
