import { useEffect, useRef, useState } from 'react'
import { BENCHMARKS } from '../data/portfolio'

const fmtChg = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%`

// "Compare" button above the chart: opens a small panel with one checkbox
// per index (S&P 500, DAX, MSCI World), each in its own line colour.
// changes: { key: % change over the visible period } once data has loaded.
export default function CompareMenu({ selected, onToggle, changes, onOpen }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const toggleOpen = () => {
    if (!open) onOpen?.()
    setOpen(!open)
  }

  return (
    <div className="compare" ref={ref}>
      <button className={`compare-btn ${selected.length ? 'active' : ''}`} onClick={toggleOpen} aria-expanded={open}>
        Compare
        {selected.length > 0 && <span className="compare-count">{selected.length}</span>}
      </button>
      {open && (
        <div className="compare-panel" role="group" aria-label="Compare with index">
          <div className="compare-title">Compare with</div>
          {BENCHMARKS.map((b) => {
            const on = selected.includes(b.key)
            const chg = changes?.[b.key]
            return (
              <label key={b.key} className="compare-row">
                <input type="checkbox" checked={on} onChange={() => onToggle(b.key)} />
                <span className="compare-box" style={{ borderColor: b.color, background: on ? b.color : 'transparent' }}>
                  {on && (
                    <svg viewBox="0 0 12 12" width="10" height="10">
                      <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="compare-name">{b.label}</span>
                {chg != null && <span className={`compare-chg ${chg >= 0 ? 'up' : 'down'}`}>{fmtChg(chg)}</span>}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
