import { useEffect, useRef, useState } from 'react'

const SLIDES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// Fullscreen walkthrough: swipe left/right through the slide images, X to exit.
export default function TutorialOverlay({ open, onClose }) {
  const trackRef = useRef(null)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (open && trackRef.current) {
      trackRef.current.scrollTo({ left: 0, behavior: 'instant' })
      setIdx(0)
    }
  }, [open])

  if (!open) return null

  const onScroll = () => {
    const el = trackRef.current
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <div className="tut-overlay">
      <button className="tut-close" onClick={onClose} aria-label="Close tutorial">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>

      <div className="tut-track" ref={trackRef} onScroll={onScroll}>
        {SLIDES.map((n) => (
          <div className="tut-slide" key={n}>
            <img src={`/tutorial/${n}.jpg`} alt={`Walkthrough slide ${n}`} draggable="false" />
          </div>
        ))}
      </div>

      <div className="tut-dots">
        {SLIDES.map((n, i) => (
          <span key={n} className={`tut-dot ${i === idx ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  )
}
