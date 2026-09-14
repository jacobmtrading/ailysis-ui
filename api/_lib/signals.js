// Strategy math for the scraper — pure functions, no network, zero tokens.
// Two entries that buy BEFORE the move instead of after it:
//   dip      — a major, statistically unusual drop (vs the stock's own
//              volatility and vs the market) in a name whose trend was intact.
//   catalyst — a major upcoming event (earnings this stock historically moves
//              big on, investor day, keynote, FDA decision…) that the price
//              has not reacted to yet.
// These only decide what deserves a board call; the board still votes.

const DAY = 86400e3
const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100
const pct = (a, b) => (a / b - 1) * 100
const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length
export const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY)

export const DIP = {
  drop1d: 4, // % down today (single stock) …
  drop5d: 8, // … or over 5 sessions
  etfDrop1d: 2.5, // broad ETFs move less, so a lower bar
  etfDrop5d: 5,
  sigmas: 2.5, // AND unusual for this name: ≥2.5σ beyond the market
  maxFromHigh: -45, // deeper than this is a collapse, not a dip
  minBounce: 0.25, // wait until price is 25% off the intraday low (no knife-catching)
}

export const CATALYST = {
  minDays: 4, // time for the run-up to happen…
  maxDays: 21, // …but close enough to matter
  eventMove: 4, // earnings are "major" if the stock typically moves ≥4%…
  eventSigmas: 2.5, // …and ≥2.5 normal days' worth
  maxRunupSigmas: 1, // not priced in: 10-day run-up vs market under 1σ
  maxRunupShare: 0.5, // and under half the typical event move
  maxVolume: 1.5, // and no accumulation yet (5d volume < 1.5× the 60d average)
}

// Daily bars (oldest first, before today) -> the per-stock numbers the
// strategies compare live quotes against. reportDates: past earnings, newest first.
export function computeBaseline(bars, today, reportDates = []) {
  const b = bars.filter((x) => x.t < today)
  const n = b.length
  if (n < 61) return null
  const c = b.map((x) => x.c)
  const rets = []
  for (let i = n - 60; i < n; i++) rets.push(pct(c[i], c[i - 1]))
  const m = avg(rets)
  const sigma = Math.sqrt(rets.reduce((s, r) => s + (r - m) ** 2, 0) / (rets.length - 1))

  // Typical earnings reaction: the bigger of the report day and the day after
  // (covers both before-open and after-close reports).
  const moves = []
  for (const d of reportDates.slice(0, 4)) {
    const i = b.findIndex((x) => x.t >= d)
    if (i < 1) continue
    moves.push(Math.max(Math.abs(pct(c[i], c[i - 1])), i + 1 < n ? Math.abs(pct(c[i + 1], c[i])) : 0))
  }

  const vols = b.map((x) => x.v)
  const v60 = avg(vols.slice(-60))
  return {
    asOf: b[n - 1].t,
    sigma: r2(sigma), // daily % volatility over the last 60 sessions
    prevClose: c[n - 1],
    c5: c[n - 5],
    c10: c[n - 10],
    sma200: n >= 200 ? r2(avg(c.slice(-200))) : null,
    hi52: Math.max(...c.slice(-252)),
    vol5v60: v60 > 0 ? r2(avg(vols.slice(-5)) / v60) : null,
    lastReport: reportDates[0] || null,
    earningsMove: moves.length >= 2 ? r1(avg(moves)) : null,
  }
}

export function marketMoves(q, b) {
  if (!q || !b) return { d1: 0, d5: 0, d10: 0 }
  return { d1: q.dayChgPct, d5: pct(q.price, b.c5), d10: pct(q.price, b.c10) }
}

// Move over the last 5 or 10 sessions, minus the market, in sigmas of this stock's volatility.
export function excessMove(q, b, mkt, days) {
  const own = pct(q.price, days === 5 ? b.c5 : b.c10)
  const x = own - (days === 5 ? mkt.d5 : mkt.d10)
  return { own: r1(own), x: r1(x), z: r2(x / (b.sigma * Math.sqrt(days))) }
}

// ---------- Strategy 1: buy major, unusual dips ----------
export function dipSetup(entry, q, b, mkt, today) {
  if (!q || !b || !b.sigma) return null
  const isEtf = entry.type === 'etf'
  // Single stocks are measured against the market so a broad sell-off doesn't
  // look idiosyncratic; ETFs (the market itself) on their raw move.
  const d1 = q.dayChgPct
  const z1 = (isEtf ? d1 : d1 - mkt.d1) / b.sigma
  const m5 = excessMove(q, b, isEtf ? { d5: 0 } : mkt, 5)
  const oneDay = d1 <= -(isEtf ? DIP.etfDrop1d : DIP.drop1d) && z1 <= -DIP.sigmas
  const multiDay = m5.own <= -(isEtf ? DIP.etfDrop5d : DIP.drop5d) && m5.z <= -DIP.sigmas
  if (!oneDay && !multiDay) return null

  const fromHigh = pct(q.price, b.hi52)
  if (fromHigh <= DIP.maxFromHigh) return null
  const range = q.high && q.low && q.high > q.low ? q.high - q.low : 0
  const bounce = range ? (q.price - q.low) / range : null
  if (bounce != null && bounce < DIP.minBounce) return { waiting: true }

  const ref = oneDay ? b.prevClose : b.c5
  const zMin = Math.min(oneDay ? z1 : Infinity, multiDay ? m5.z : Infinity)
  const trendOk = b.sma200 ? ref > b.sma200 : null
  const sinceReport = b.lastReport ? daysBetween(b.lastReport, today) : null
  const postEarnings = sinceReport != null && sinceReport <= 5
  const toEarnings = q.earnings?.date ? daysBetween(today, q.earnings.date) : null
  const earningsSoon = toEarnings != null && toEarnings >= 0 && toEarnings <= 5

  let score = 3
  if (zMin <= -4) score += 1
  if (trendOk === true) score += 1
  if (trendOk === false) score -= 1
  if (postEarnings) score -= 2 // post-earnings drops tend to keep drifting
  if (earningsSoon) score -= 1
  if (score < 2) return null

  const drop = oneDay ? `${r1(d1)}% today` : `${m5.own}% in 5 sessions`
  const signals = [
    `Unusual dip: ${drop} — ${r1(zMin)}σ vs its own volatility${isEtf ? '' : `, market ${r1(oneDay ? mkt.d1 : mkt.d5)}%`}`,
  ]
  if (trendOk === true) signals.push('Trend was intact before the drop (above 200-day average)')
  if (trendOk === false) signals.push('Already below its 200-day average before the drop')
  if (postEarnings) signals.push(`Post-earnings drop (reported ${b.lastReport}) — these tend to keep drifting`)
  if (earningsSoon) signals.push(`Earnings in ${toEarnings} days — binary risk`)

  return {
    strategy: 'dip',
    score,
    signals,
    refPrice: r2(ref),
    setup: {
      drop_today_pct: r1(d1),
      drop_5d_pct: m5.own,
      market_today_pct: r1(mkt.d1),
      market_5d_pct: r1(mkt.d5),
      drop_in_sigmas: r1(zMin),
      daily_volatility_pct: b.sigma,
      pre_dip_price: r2(ref),
      pct_vs_200d_avg_before_dip: b.sma200 ? r1(pct(ref, b.sma200)) : null,
      pct_from_52w_high: r1(fromHigh),
      bounce_off_intraday_low_pct: bounce == null ? null : Math.round(bounce * 100),
      post_earnings: postEarnings,
      last_earnings: b.lastReport,
      next_earnings: q.earnings?.date || null,
      pe: q.pe,
      forward_pe: q.fpe,
    },
  }
}

// ---------- Strategy 2: upcoming catalysts not yet priced in ----------
export function catalystSetup(entry, q, b, mkt, events, today) {
  if (entry.type !== 'stock' || !q || !b || !b.sigma) return null
  if ((q.dayChgPct - mkt.d1) / b.sigma <= -DIP.sigmas) return null // falling hard: the dip path's call
  const run = excessMove(q, b, mkt, 10)
  if (run.z >= CATALYST.maxRunupSigmas) return null
  if (b.vol5v60 != null && b.vol5v60 >= CATALYST.maxVolume) return null

  const runTxt = `${run.x >= 0 ? '+' : ''}${run.x}% vs the market over 10 sessions`
  const base = {
    runup_10d_pct: run.own,
    market_10d_pct: r1(mkt.d10),
    runup_vs_market_sigmas: run.z,
    volume_5d_vs_60d: b.vol5v60,
    daily_volatility_pct: b.sigma,
    pct_from_52w_high: r1(pct(q.price, b.hi52)),
    next_earnings: q.earnings?.date || null,
    pe: q.pe,
    forward_pe: q.fpe,
  }

  // Earnings where this stock historically reacts big.
  const e = q.earnings
  const eDays = e?.date ? daysBetween(today, e.date) : null
  const move = b.earningsMove
  if (
    eDays != null && eDays >= CATALYST.minDays && eDays <= CATALYST.maxDays &&
    move && move >= Math.max(CATALYST.eventMove, CATALYST.eventSigmas * b.sigma) &&
    run.x < CATALYST.maxRunupShare * move
  ) {
    let score = 2
    if (move >= 3.5 * b.sigma) score += 1
    if (e.confirmed) score += 1
    if (run.z <= 0) score += 1
    return {
      strategy: 'catalyst',
      score,
      signals: [
        `Upcoming catalyst: earnings ${e.date} (in ${eDays}d${e.confirmed ? '' : ', date estimated'}) — typically moves ±${move}%, stock only ${runTxt}`,
      ],
      event: { kind: 'earnings', date: e.date, timing: e.timing, title: 'Quarterly earnings' },
      setup: {
        event: { kind: 'earnings', date: e.date, days_until: eDays, date_confirmed: e.confirmed, timing: e.timing },
        typical_event_move_pct: move,
        runup_share_of_typical_move_pct: Math.round((Math.max(0, run.x) / move) * 100),
        ...base,
      },
    }
  }

  // Non-earnings events found in the news.
  for (const ev of events || []) {
    const d = ev.date ? daysBetween(today, ev.date) : null
    if (d != null && (d < CATALYST.minDays || d > CATALYST.maxDays)) continue
    let score = 2
    if (d != null) score += 1
    if (run.z <= 0) score += 1
    return {
      strategy: 'catalyst',
      score,
      signals: [
        `Upcoming catalyst: ${ev.kind} ${d != null ? `on ${ev.date} (in ${d}d)` : '(date unconfirmed)'} — stock only ${runTxt}`,
      ],
      event: { kind: ev.kind, date: ev.date, timing: null, title: ev.title },
      setup: { event: { kind: ev.kind, date: ev.date, days_until: d, headline: ev.title }, ...base },
    }
  }
  return null
}

// ---------- Event headlines (Google News titles -> forward-looking events) ----------
const EVENT_RE = /\b(investor day|analyst day|capital markets day|keynote|launch event|product event|ai day|unveil\w*|fda|pdufa|data readout|topline)\b/i
const UPCOMING_RE = /\b(to (host|hold|present|unveil|announce|showcase|debut|launch|reveal)|will (host|hold|present|unveil|announce|showcase|debut|launch|reveal)|upcoming|ahead of|set to|scheduled|what to expect|preview|next week|expected to|awaits?|awaiting)\b/i
const PAST_RE = /\b(unveils|unveiled|announced|recap|debuts|debuted|launches|launched|highlights|hosted|presented|wrapped|approves|approved|rejects|rejected)\b/i
const NAMED_EVENT_RE = /\b(investor day|analyst day|capital markets day|keynote|launch event|product event|ai day|fda|pdufa|data readout|topline)\b/i
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// Does the headline name the company itself (not just mention its event words)?
export function mentions(names, title) {
  return names.some((name) =>
    new RegExp(`(^|[^\\w&])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\w&])`, 'i').test(title)
  )
}

const kindOf = (t) =>
  /fda|pdufa|readout|topline/i.test(t) ? 'FDA/clinical decision'
    : /investor day|analyst day|capital markets day/i.test(t) ? 'investor day'
      : 'product event/keynote'

// "… on Sept. 22" -> '2026-09-22' (year from the publish date).
export function dateHint(title, pubDay) {
  const m = title.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i)
  if (!m) return null
  const mon = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
  const day = +m[2]
  if (day < 1 || day > 31) return null
  const pub = Date.parse(`${pubDay}T12:00:00Z`)
  const year = new Date(pub).getUTCFullYear()
  let d = Date.UTC(year, mon, day)
  if (d < pub - 60 * DAY) d = Date.UTC(year + 1, mon, day)
  return new Date(d).toISOString().slice(0, 10)
}

// items: [{ title, pub: 'YYYY-MM-DD' }] -> up to 2 upcoming events, dated ones first.
export function upcomingEvents(items, today) {
  const recaps = items.filter((i) => EVENT_RE.test(i.title) && PAST_RE.test(i.title) && !UPCOMING_RE.test(i.title))
  const out = []
  for (const i of items) {
    if (!EVENT_RE.test(i.title) || !UPCOMING_RE.test(i.title)) continue
    const date = dateHint(i.title, i.pub)
    if (date && date < today) continue
    // Undated previews: only fresh ones, and not if a recap came out since.
    if (!date && (daysBetween(i.pub, today) > 7 || recaps.some((r) => r.pub >= i.pub))) continue
    // A vague undated "to unveil…" is noise; undated events must be a named type.
    if (!date && !NAMED_EVENT_RE.test(i.title)) continue
    out.push({ title: i.title.slice(0, 160), pub: i.pub, date, kind: kindOf(i.title) })
  }
  return out
    .sort((a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || b.pub.localeCompare(a.pub))
    .slice(0, 2)
}

// ---------- Exit plans (stored on the position, enforced by api/cron/prices.js) ----------
export function buildPlan(candidate, price, holdThroughEvent) {
  if (candidate.strategy === 'dip') {
    // Take profit once half the drop is recovered — it's a rebound trade, not a new trend.
    const target = Math.max(price * 1.02, price + 0.5 * (candidate.refPrice - price))
    return { strategy: 'dip', refPrice: candidate.refPrice, targetPrice: r2(target), reviewAfter: Date.now() + 28 * DAY }
  }
  if (candidate.strategy === 'catalyst') {
    const event = candidate.event
    const plan = { strategy: 'catalyst', event, holdThroughEvent: Boolean(holdThroughEvent) }
    if (!event.date) return { ...plan, reviewAfter: Date.now() + 14 * DAY }
    if (plan.holdThroughEvent) return { ...plan, reviewAfter: Date.parse(`${event.date}T20:00:00Z`) + 2 * DAY }
    return { ...plan, exitAt: exitBefore(event.date, event.timing) }
  }
  return null
}

// ~15:00 New York (19:00 UTC) on the last session before the event reaction:
// the event day itself for after-close reports, otherwise the prior weekday.
export function exitBefore(date, timing) {
  let t = Date.parse(`${date}T19:00:00Z`)
  if (timing !== 'after') {
    do t -= DAY
    while ([0, 6].includes(new Date(t).getUTCDay()))
  }
  return t
}

export function describePlan(plan) {
  if (!plan) return ''
  if (plan.strategy === 'dip') return `take profit at $${plan.targetPrice} (half the drop recovered)`
  if (plan.exitAt) return `sell before the ${plan.event.kind} on ${plan.event.date}`
  return `hold through the ${plan.event.kind}${plan.event.date ? ` on ${plan.event.date}` : ''}, then review`
}
