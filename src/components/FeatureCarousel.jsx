import { useRef, useState } from 'react'
import { FEATURES, TIER_LABEL, isLocked } from '../data/features'

// Line icons, one per feature, drawn on a 48×48 grid.
const ICONS = {
  portfolio: <path d="M6 36l10-11 8 7 16-18M30 14h10v10" />,
  analyze: (
    <>
      <path d="M8 12h24a4 4 0 014 4v12a4 4 0 01-4 4H18l-7 6v-6H8a4 4 0 01-4-4V16a4 4 0 014-4z" />
      <path d="M14 22h12M14 27h7" />
    </>
  ),
  build: (
    <>
      <rect x="7" y="26" width="9" height="14" rx="2" />
      <rect x="20" y="17" width="9" height="23" rx="2" />
      <rect x="33" y="8" width="9" height="32" rx="2" />
    </>
  ),
  check: (
    <>
      <rect x="9" y="6" width="30" height="36" rx="4" />
      <path d="M16 24l6 6 11-12" />
    </>
  ),
  map: (
    <>
      <circle cx="24" cy="24" r="17" />
      <circle cx="24" cy="24" r="9" />
      <path d="M24 7v34M7 24h34" />
    </>
  ),
  swot: (
    <>
      <rect x="7" y="7" width="15" height="15" rx="3" />
      <rect x="26" y="7" width="15" height="15" rx="3" />
      <rect x="7" y="26" width="15" height="15" rx="3" />
      <rect x="26" y="26" width="15" height="15" rx="3" />
    </>
  ),
  stress: <path d="M4 26h8l5-14 8 26 6-18 4 6h9" />,
}

// Which plan a feature needs — green once the logged-in user has it.
function badgeFor(feature, user) {
  const text = feature.tier ? TIER_LABEL[feature.tier] : 'Any account'
  if (!user) return { text, cls: '' }
  if (isLocked(feature, user)) return { text: `${text} 🔒`, cls: 'lock' }
  return { text: `${text} ✓`, cls: 'open' }
}

// The landing runs the list back to front: stress test first, AI portfolio last.
const ORDER = [...FEATURES].reverse()

// Landing page body: one feature at a time, swipe left/right, tap to open.
export default function FeatureCarousel({ user, onPick }) {
  const trackRef = useRef(null)
  const [idx, setIdx] = useState(0)

  const onScroll = () => {
    const el = trackRef.current
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth))
  }
  const go = (i) => {
    const el = trackRef.current
    const n = Math.max(0, Math.min(ORDER.length - 1, i))
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="feat">
      <div className="feat-track" ref={trackRef} onScroll={onScroll}>
        {ORDER.map((f) => {
          const badge = badgeFor(f, user)
          return (
            <div className="feat-slide" key={f.id}>
              <button className={`feat-card ${f.id === 'portfolio' ? 'dark' : ''}`} onClick={() => onPick(f)}>
                <span className={`feat-badge ${badge.cls}`}>{badge.text}</span>
                <svg className="feat-icon" viewBox="0 0 48 48" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  {ICONS[f.id]}
                </svg>
                <span className="feat-name">{f.name}</span>
                <span className="feat-blurb">{f.blurb}</span>
                <span className="feat-cta">{user ? 'Try it' : 'Log in to try'} →</span>
              </button>
            </div>
          )
        })}
      </div>

      <div className="feat-nav">
        <button className="feat-arrow" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Previous feature">
          ‹
        </button>
        <div className="feat-dots">
          {ORDER.map((f, i) => (
            <button key={f.id} className={`feat-dot ${i === idx ? 'active' : ''}`} onClick={() => go(i)} aria-label={f.name} />
          ))}
        </div>
        <button className="feat-arrow" onClick={() => go(idx + 1)} disabled={idx === ORDER.length - 1} aria-label="Next feature">
          ›
        </button>
      </div>
    </div>
  )
}
