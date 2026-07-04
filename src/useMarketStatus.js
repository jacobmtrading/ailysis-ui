import { useEffect, useState } from 'react'

// NYSE regular hours: 09:30–16:00 America/New_York, Mon–Fri.
// (Holidays are ignored — this is a demo UI.)
const OPEN_MIN = 9 * 60 + 30
const CLOSE_MIN = 16 * 60

function etParts(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const p = {}
  for (const { type, value } of dtf.formatToParts(date)) p[type] = value
  return {
    y: +p.year,
    mo: +p.month,
    d: +p.day,
    h: p.hour === '24' ? 0 : +p.hour,
    mi: +p.minute,
    s: +p.second,
  }
}

// Current ET UTC offset in ms (handles DST).
function etOffsetMs(date) {
  const p = etParts(date)
  const asUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
  return asUTC - date.getTime()
}

// Convert an ET wall-clock moment to a real epoch timestamp.
function etWallToEpoch(y, mo, d, h, mi, ref) {
  const asUTC = Date.UTC(y, mo - 1, d, h, mi, 0)
  return asUTC - etOffsetMs(ref)
}

function computeStatus(now) {
  const p = etParts(now)
  const dow = new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay() // 0 Sun .. 6 Sat
  const min = p.h * 60 + p.mi
  const isWeekday = dow >= 1 && dow <= 5
  const isOpen = isWeekday && min >= OPEN_MIN && min < CLOSE_MIN

  if (isOpen) {
    const target = etWallToEpoch(p.y, p.mo, p.d, 16, 0, now)
    return { open: true, target }
  }

  // Find next open: today (if before open on a weekday) else scan forward.
  for (let add = 0; add <= 7; add++) {
    const cand = new Date(Date.UTC(p.y, p.mo - 1, p.d + add))
    const cdow = cand.getUTCDay()
    if (cdow < 1 || cdow > 5) continue
    if (add === 0 && min >= OPEN_MIN) continue // already past open today
    const target = etWallToEpoch(
      cand.getUTCFullYear(),
      cand.getUTCMonth() + 1,
      cand.getUTCDate(),
      9,
      30,
      now
    )
    return { open: false, target }
  }
  return { open: false, target: now.getTime() }
}

function fmtCountdown(ms) {
  if (ms < 0) ms = 0
  const total = Math.floor(ms / 1000)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function useMarketStatus() {
  const [state, setState] = useState(() => {
    const now = new Date()
    const s = computeStatus(now)
    return { ...s, label: fmtCountdown(s.target - now.getTime()) }
  })

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const s = computeStatus(now)
      setState({ ...s, label: fmtCountdown(s.target - now.getTime()) })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return state
}
