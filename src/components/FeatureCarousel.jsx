import { useEffect, useRef } from 'react'
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
  lab: (
    <>
      <path d="M19 6h10M21 6v13L9 38a3 3 0 002.6 4.5h24.8A3 3 0 0039 38L27 19V6" />
      <path d="M14 30h20" />
    </>
  ),
}

// Which plan a feature needs — green once the logged-in user has it.
function badgeFor(feature, user) {
  const text = feature.tier ? TIER_LABEL[feature.tier] : 'Any account'
  if (!user) return { text, cls: '' }
  if (isLocked(feature, user)) return { text: `${text} 🔒`, cls: 'lock' }
  return { text: `${text} ✓`, cls: 'open' }
}

// The landing leads with the Lab (the hub every tool opens into), then runs the
// rest back to front: stress test first, AI portfolio last.
const ORDER = [FEATURES.find((f) => f.id === 'lab'), ...FEATURES.filter((f) => f.id !== 'lab').reverse()]

// Phones swipe through the list endlessly in both directions: three copies are
// rendered and, once a swipe settles on an outer copy, the track jumps (without
// animation) to the same card in the middle copy. Desktop shows a grid of the
// middle copy only (clones hidden in CSS).
const LOOP = [...ORDER, ...ORDER, ...ORDER]
const N = ORDER.length

// Landing page body: one feature at a time, swipe left/right, tap to open.
export default function FeatureCarousel({ user, onPick }) {
  const track = useRef(null)

  useEffect(() => {
    const el = track.current
    const width = () => el.clientWidth
    el.scrollLeft = N * width()

    let timer
    const recenter = () => {
      const w = width()
      if (!w) return
      const i = Math.round(el.scrollLeft / w)
      if (i < N || i >= 2 * N) el.scrollLeft = (((i % N) + N) % N + N) * w
    }
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(recenter, 120)
    }
    const onResize = () => {
      el.scrollLeft = N * width()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div className="feat">
      <div className="feat-track" ref={track}>
        {LOOP.map((f, i) => {
          const badge = badgeFor(f, user)
          const clone = i < N || i >= 2 * N
          return (
            <div className={`feat-slide${clone ? ' clone' : ''}`} key={`${f.id}-${i}`} aria-hidden={clone || undefined}>
              <button className={`feat-card${f.id === 'lab' ? ' feat-lab' : ''}`} onClick={() => onPick(f)} tabIndex={clone ? -1 : undefined}>
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
    </div>
  )
}
