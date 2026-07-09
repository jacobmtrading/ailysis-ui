import { useEffect, useState } from 'react'

// Combined market status: open when Xetra (9:00–17:30 Berlin) OR NYSE
// (9:30–16:00 New York) is open, Mon–Fri. Holidays ignored (demo-grade).
// On weekdays the two sessions overlap, so the combined session runs from
// Xetra open until NYSE close.

const MARKETS = {
  xetra: { tz: 'Europe/Berlin', open: 9 * 60, close: 17 * 60 + 30, name: 'Xetra' },
  nyse: { tz: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60, name: 'NYSE' },
}

function tzParts(tz, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
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
  return { y: +p.year, mo: +p.month, d: +p.day, h: p.hour === '24' ? 0 : +p.hour, mi: +p.minute, s: +p.second }
}

function tzOffsetMs(tz, date) {
  const p = tzParts(tz, date)
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - date.getTime()
}

function wallToEpoch(tz, y, mo, d, h, mi, ref) {
  return Date.UTC(y, mo - 1, d, h, mi, 0) - tzOffsetMs(tz, ref)
}

function marketNow(mkt, now) {
  const p = tzParts(mkt.tz, now)
  const dow = new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()
  const min = p.h * 60 + p.mi
  const isWeekday = dow >= 1 && dow <= 5
  const open = isWeekday && min >= mkt.open && min < mkt.close
  return { p, dow, min, open }
}

function nextOpenEpoch(mkt, now) {
  const { p, min } = marketNow(mkt, now)
  for (let add = 0; add <= 7; add++) {
    const cand = new Date(Date.UTC(p.y, p.mo - 1, p.d + add))
    const cdow = cand.getUTCDay()
    if (cdow < 1 || cdow > 5) continue
    if (add === 0 && min >= mkt.open) continue
    return wallToEpoch(mkt.tz, cand.getUTCFullYear(), cand.getUTCMonth() + 1, cand.getUTCDate(), Math.floor(mkt.open / 60), mkt.open % 60, now)
  }
  return now.getTime()
}

function closeEpochToday(mkt, now) {
  const { p } = marketNow(mkt, now)
  return wallToEpoch(mkt.tz, p.y, p.mo, p.d, Math.floor(mkt.close / 60), mkt.close % 60, now)
}

function computeStatus(now) {
  const xetra = marketNow(MARKETS.xetra, now)
  const nyse = marketNow(MARKETS.nyse, now)

  if (xetra.open || nyse.open) {
    // Combined session ends at NYSE close (overlaps with Xetra on weekdays).
    const target = nyse.open || xetra.open ? Math.max(closeEpochToday(MARKETS.nyse, now), closeEpochToday(MARKETS.xetra, now)) : now.getTime()
    const label2 = xetra.open && nyse.open ? 'Xetra + NYSE' : xetra.open ? 'Xetra' : 'NYSE'
    return { open: true, target, label2 }
  }
  const target = Math.min(nextOpenEpoch(MARKETS.xetra, now), nextOpenEpoch(MARKETS.nyse, now))
  return { open: false, target, label2: '' }
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
