import { useEffect, useState } from 'react'

// Small announcement bubble that hangs off the "?" button on first visit.
// Bump the key when there's a new announcement to show it again.
const KEY = 'ailysis_whatsnew_swarm_v1'

export default function WhatsNew({ show }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!show) return
    let seen = false
    try {
      seen = localStorage.getItem(KEY) === '1'
    } catch {
      /* private mode — just show it */
    }
    if (seen) return
    const t = setTimeout(() => setOpen(true), 600)
    return () => clearTimeout(t)
  }, [show])

  if (!open) return null

  const dismiss = () => {
    setOpen(false)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* nothing to remember, it'll show again */
    }
  }

  return (
    <div className="whatsnew" role="dialog" aria-label="What's new">
      <button className="whatsnew-close" onClick={dismiss} aria-label="Dismiss">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </button>

      <div className="whatsnew-tag">
        <span className="whatsnew-dot" />
        What's new?
      </div>

      <div className="whatsnew-title">Swarm intelligence</div>
      <div className="whatsnew-body">
        Ailysis has gone from one agent to a swarm — several agents now interact and cross-check every call.
      </div>

      <button className="whatsnew-ok" onClick={dismiss}>
        Got it
      </button>
    </div>
  )
}
