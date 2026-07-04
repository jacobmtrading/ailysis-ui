import { useEffect, useState } from 'react'

// Fullscreen intro: "Think Less" (top) / spinning globe with "ailysis" (center)
// / "Profit More" (bottom). Fades out after a few seconds; tap to skip.
export default function Intro({ onDone }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 3400)
    const t2 = setTimeout(() => onDone(), 4200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [onDone])

  const skip = () => {
    setLeaving(true)
    setTimeout(onDone, 700)
  }

  return (
    <div className={`intro ${leaving ? 'intro-leave' : ''}`} onClick={skip}>
      <div className="intro-slogan intro-top">Think Less</div>

      <div className="globe-wrap">
        <Globe />
        <div className="globe-word">ailysis</div>
      </div>

      <div className="intro-slogan intro-bottom">Profit More</div>
      <div className="intro-skip">tap to skip</div>
    </div>
  )
}

function Globe() {
  // SVG globe: sphere + rotating meridians clipped to the circle.
  const meridians = [0.2, 0.45, 0.7, 0.92]
  return (
    <svg viewBox="0 0 200 200" className="globe">
      <defs>
        <radialGradient id="sphere" cx="40%" cy="36%" r="80%">
          <stop offset="0%" stopColor="#161616" />
          <stop offset="70%" stopColor="#0b0b0b" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <clipPath id="ball">
          <circle cx="100" cy="100" r="86" />
        </clipPath>
      </defs>

      <circle cx="100" cy="100" r="86" fill="url(#sphere)" />
      <circle cx="100" cy="100" r="86" fill="none" stroke="#00c46e" strokeOpacity="0.6" strokeWidth="1" />

      {/* parallels (latitude) */}
      <g clipPath="url(#ball)" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="0.8" fill="none">
        {[-56, -28, 0, 28, 56].map((dy, i) => (
          <ellipse key={i} cx="100" cy={100 + dy} rx="86" ry={Math.max(6, 86 - Math.abs(dy) * 0.9)} />
        ))}
      </g>

      {/* meridians (longitude) — animated to look like rotation */}
      <g clipPath="url(#ball)" className="globe-spin" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="0.8" fill="none">
        {meridians.map((f, i) => (
          <ellipse key={i} cx="100" cy="100" rx={86 * f} ry="86" />
        ))}
        <line x1="100" y1="14" x2="100" y2="186" />
      </g>
    </svg>
  )
}
