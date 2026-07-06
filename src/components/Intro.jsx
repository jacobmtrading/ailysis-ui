import { useEffect, useRef, useState } from 'react'

// Fullscreen intro: types out the slogan one letter at a time, then reveals
// "ailysis" beneath it. Tap to skip.
const PHRASE = 'Think Less,\nProfit More'

export default function Intro({ onDone }) {
  const [typed, setTyped] = useState(0)
  const [showBrand, setShowBrand] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const timers = useRef([])

  useEffect(() => {
    let i = 0
    const step = () => {
      i += 1
      setTyped(i)
      if (i < PHRASE.length) {
        timers.current.push(setTimeout(step, 62))
      } else {
        timers.current.push(setTimeout(() => setShowBrand(true), 400))
        timers.current.push(setTimeout(() => setLeaving(true), 1900))
        timers.current.push(setTimeout(() => onDone(), 2500))
      }
    }
    timers.current.push(setTimeout(step, 400))
    return () => timers.current.forEach(clearTimeout)
  }, [onDone])

  const skip = () => {
    timers.current.forEach(clearTimeout)
    setLeaving(true)
    setTimeout(onDone, 500)
  }

  const done = typed >= PHRASE.length

  return (
    <div className={`intro ${leaving ? 'intro-leave' : ''}`} onClick={skip}>
      <div className="intro-inner">
        <div className="intro-typed">
          {PHRASE.slice(0, typed)}
          <span className={`intro-caret ${showBrand ? 'hide' : ''}`} />
        </div>
        <div className={`intro-brand ${showBrand ? 'show' : ''}`}>ailysis</div>
      </div>
      <div className="intro-skip">{done ? '' : 'tap to skip'}</div>
    </div>
  )
}
