import { useEffect, useMemo, useState } from 'react'
import * as api from '../account'
import { SCENARIOS } from '../../api/_lib/scenarios.js'
import { byTicker } from '../../api/_lib/universe.js'

// ---------------- Polar risk map geometry ----------------
// Three axes, 120° apart. A security's dot is the score-weighted blend of the
// axis directions (barycentric): all-equal scores land in the center, a single
// dominant axis pulls the dot out to that rim.
const VB_W = 760
const VB_H = 470
const CX = 380
const CY = 240
const R = 180
const AXES = [
  { key: 'political', label: 'Political dependency', a: -Math.PI / 2 },
  { key: 'momentum', label: 'Momentum / news', a: Math.PI / 6 },
  { key: 'valuation', label: 'Overvaluation', a: (5 * Math.PI) / 6 },
]

function place(s) {
  let x = 0
  let y = 0
  let sum = 0
  for (const ax of AXES) {
    const v = (s[ax.key] ?? 50) / 100
    x += Math.cos(ax.a) * v
    y += Math.sin(ax.a) * v
    sum += v
  }
  if (!sum) return { x: CX, y: CY }
  return { x: CX + (x / sum) * R, y: CY + (y / sum) * R }
}

const IND_COLORS = {
  Technology: '#5b8def',
  Healthcare: '#06c167',
  Financials: '#f2a33c',
  Energy: '#e4572e',
  Consumer: '#b455e8',
  Industrials: '#8a97a8',
  'Aerospace & Defence': '#3ec1c9',
  Communication: '#ef5da8',
}
const indColor = (ind) => IND_COLORS[ind] || '#7d8a99'

function useIsPortrait() {
  const [portrait, setPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const fn = (e) => setPortrait(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return portrait
}

// ---------------- Polar map view ----------------
function PolarMap({ data, weights, showProposals, sel, onSelect, onDismiss }) {
  const clusters = useMemo(() => {
    const groups = {}
    for (const s of data.stocks) {
      const ind = s.industry || 'Other'
      ;(groups[ind] = groups[ind] || []).push(place(s))
    }
    return Object.entries(groups)
      .map(([ind, pts]) => {
        const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length
        const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length
        const r = Math.max(46, ...pts.map((p) => Math.hypot(p.x - cx, p.y - cy) + 32))
        return { ind, cx, cy, r, n: pts.length }
      })
      .sort((a, b) => b.r - a.r)
  }, [data.stocks])

  const dotR = (t) => 9 + Math.sqrt(weights[t] || 4) * 1.4

  return (
    <div className="ins-chartwrap" onClick={onDismiss}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="ins-svg">
        {/* rings + axes */}
        {[0.33, 0.66, 1].map((f) => (
          <circle key={f} cx={CX} cy={CY} r={R * f} fill="none" stroke="var(--hair)" strokeWidth="1.5" />
        ))}
        {AXES.map((ax) => {
          const ex = CX + Math.cos(ax.a) * R
          const ey = CY + Math.sin(ax.a) * R
          const lx = CX + Math.cos(ax.a) * (R + 26)
          const ly = CY + Math.sin(ax.a) * (R + 26)
          return (
            <g key={ax.key}>
              <line x1={CX} y1={CY} x2={ex} y2={ey} stroke="var(--faint)" strokeWidth="1.5" strokeDasharray="2 4" />
              <text x={lx} y={ly} textAnchor="middle" className="ins-axis-label">
                {ax.label}
              </text>
            </g>
          )
        })}
        <text x={CX} y={CY + 4} textAnchor="middle" className="ins-center-label">
          low risk
        </text>

        {/* industry clusters (heat blobs) */}
        {clusters.map((c) => (
          <g key={c.ind}>
            <circle cx={c.cx} cy={c.cy} r={c.r} fill={indColor(c.ind)} opacity="0.10" />
            <circle cx={c.cx} cy={c.cy} r={c.r} fill="none" stroke={indColor(c.ind)} opacity="0.4" strokeDasharray="5 5" />
            <text x={c.cx} y={c.cy - c.r - 6} textAnchor="middle" className="ins-cluster-label" fill={indColor(c.ind)}>
              {c.ind}
              {c.n > 1 ? ` ×${c.n}` : ''}
            </text>
          </g>
        ))}

        {/* proposal dots (faded, dashed) */}
        {showProposals &&
          data.proposals.map((p) => {
            const pt = place(p)
            const active = sel?.ticker === p.ticker
            return (
              <g
                key={p.ticker}
                className="ins-dot ins-proposal"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect({ ...p, ...pt, isProposal: true })
                }}
              >
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={active ? 15 : 12}
                  fill={indColor(p.industry)}
                  fillOpacity={active ? 0.65 : 0.25}
                  stroke={indColor(p.industry)}
                  strokeWidth={active ? 2.5 : 1.5}
                  strokeDasharray={active ? 'none' : '3 3'}
                />
                <text x={pt.x} y={pt.y + (active ? 29 : 26)} textAnchor="middle" className="ins-dot-label faded">
                  {p.ticker}
                </text>
              </g>
            )
          })}

        {/* holdings */}
        {data.stocks.map((s) => {
          const pt = place(s)
          const r = dotR(s.ticker)
          return (
            <g
              key={s.ticker}
              className="ins-dot"
              onClick={(e) => {
                e.stopPropagation()
                onSelect({ ...s, ...pt, isProposal: false })
              }}
            >
              <circle cx={pt.x} cy={pt.y} r={r} fill={indColor(s.industry)} stroke="#fff" strokeWidth="2" />
              <text x={pt.x} y={pt.y + r + 14} textAnchor="middle" className="ins-dot-label">
                {s.ticker}
              </text>
            </g>
          )
        })}

        {/* reasoning popup, anchored in chart coordinates next to the dot */}
        {sel &&
          (() => {
            const W = 250
            const H = 220
            const above = sel.y > CY
            const fx = Math.max(6, Math.min(VB_W - W - 6, sel.x - W / 2))
            const fy = above ? sel.y - H - 20 : sel.y + 22
            return (
              <foreignObject x={fx} y={fy} width={W} height={H} className="ins-pop-fo">
                <div className={`ins-pop-slot ${above ? 'above' : 'below'}`} onClick={(e) => e.stopPropagation()}>
                  <div className={`ins-pop ${above ? 'above' : 'below'}`}>
                    <div className="ins-pop-title">
                      {sel.ticker} <span>{sel.name || byTicker[sel.ticker]?.n}</span>
                    </div>
                    <div className="ins-pop-scores">
                      <span>🏛 {sel.political}</span>
                      <span>📰 {sel.momentum}</span>
                      <span>⚖️ {sel.valuation}</span>
                    </div>
                    <div className="ins-pop-text">{sel.isProposal ? sel.reason : sel.note || 'No notable single risk flagged.'}</div>
                    <button className="ins-pop-btn" onClick={onDismiss}>
                      {sel.isProposal ? '✓ Add to my list' : 'Close'}
                    </button>
                  </div>
                </div>
              </foreignObject>
            )
          })()}
      </svg>
    </div>
  )
}

// ---------------- SWOT view ----------------
const SWOT_QUADRANTS = [
  { key: 'strengths', title: 'Strengths', emoji: '💪', color: '#06c167' },
  { key: 'weaknesses', title: 'Weaknesses', emoji: '🩹', color: '#ff3b30' },
  { key: 'opportunities', title: 'Opportunities', emoji: '🚀', color: '#5b8def' },
  { key: 'threats', title: 'Threats', emoji: '⚠️', color: '#f2a33c' },
]

function SwotGrid({ data }) {
  return (
    <div className="swot-grid">
      {SWOT_QUADRANTS.map((q) => (
        <div key={q.key} className="swot-cell" style={{ '--qc': q.color }}>
          <div className="swot-cell-title">
            {q.emoji} {q.title}
          </div>
          <ul>
            {(data[q.key] || []).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ---------------- Stress test view ----------------
const SWARM_ICONS = {
  'Nations & governments': '🏛️',
  'Major companies': '🏢',
  Consumers: '🛒',
  'Society & markets': '🌍',
}

function StressView({ items, busy, err, data, scenarioId, onPick, onRun }) {
  const cats = [...new Set(SCENARIOS.map((s) => s.cat))]
  return (
    <div className="stress-view">
      <div className="menu-heading">Pick a scenario from the library</div>
      <div className="menu-note">Hypothetical simulations based on the current state of the world — not investment advice.</div>
      {cats.map((cat) => (
        <div key={cat}>
          <label className="menu-label stress-cat">{cat}</label>
          {SCENARIOS.filter((s) => s.cat === cat).map((s) => (
            <button key={s.id} className={`stress-row ${scenarioId === s.id ? 'on' : ''}`} onClick={() => onPick(s.id)}>
              <span className="stress-emoji">{s.emoji}</span>
              <span className="stress-main">
                <b>{s.title}</b>
                <small>{s.desc}</small>
              </span>
            </button>
          ))}
        </div>
      ))}
      <button className="menu-primary dark" disabled={!scenarioId || busy} onClick={onRun}>
        {busy ? 'Simulating world reaction…' : `Stress test ${items.length > 1 ? 'my portfolio' : items[0].ticker}`}
      </button>
      {err && <div className="menu-msg err">{err}</div>}

      {data && (
        <div className="stress-result">
          <div className="menu-heading">Step 1 · Swarm reaction</div>
          {data.swarm.map((s) => (
            <div key={s.group} className="swarm-card">
              <div className="swarm-group">
                {SWARM_ICONS[s.group] || '👥'} {s.group}
              </div>
              <div className="swarm-text">{s.reaction}</div>
            </div>
          ))}

          <div className="menu-heading">Step 2 · Impact on your positions</div>
          {data.impacts.map((im) => (
            <div key={im.ticker} className="impact-row">
              <div className="impact-head">
                <b>{im.ticker}</b>
                <span className={im.impactPct >= 0 ? 'up' : 'down'}>
                  {im.impactPct >= 0 ? '+' : ''}
                  {im.impactPct}%
                </span>
              </div>
              <div className="impact-bar">
                <div
                  className={`impact-fill ${im.impactPct >= 0 ? 'up' : 'down'}`}
                  style={{ width: `${Math.min(100, Math.abs(im.impactPct) * 1.25)}%` }}
                />
              </div>
              <div className="impact-note">{im.note}</div>
            </div>
          ))}

          <div className="stress-cols">
            <div>
              <div className="menu-heading">⚠️ Risks</div>
              <ul className="stress-list risk">
                {data.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="menu-heading">🌱 Opportunities</div>
              <ul className="stress-list opp">
                {data.opportunities.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          </div>
          {data.summary && <div className="menu-note stress-summary">{data.summary}</div>}
        </div>
      )}
    </div>
  )
}

// ---------------- Overlay shell ----------------
const VIEWS = [
  { id: 'map', label: '🧭 Risk map' },
  { id: 'swot', label: '🧩 SWOT' },
  { id: 'stress', label: '⚡ Stress test' },
]

export default function InsightsOverlay({ ctx, user, onUpgrade, onClose }) {
  const [view, setView] = useState('map')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [mapData, setMapData] = useState(null)
  const [swotData, setSwotData] = useState(null)
  const [stressData, setStressData] = useState(null)
  const [scenarioId, setScenarioId] = useState(null)
  const [showProposals, setShowProposals] = useState(false)
  const [sel, setSel] = useState(null)
  const [added, setAdded] = useState([])
  const portrait = useIsPortrait()

  // New subject → start fresh.
  useEffect(() => {
    setView(ctx?.view || 'map')
    setMapData(null)
    setSwotData(null)
    setStressData(null)
    setScenarioId(null)
    setShowProposals(false)
    setSel(null)
    setAdded([])
    setErr(null)
  }, [ctx])

  const items = ctx?.items || []
  const weights = useMemo(() => Object.fromEntries(items.map((i) => [i.ticker, i.weightPct])), [items])

  const needTier = items.length > 1 ? 'tailormade' : 'premium'
  const tierRank = { free: 0, premium: 1, tailormade: 2 }
  const locked = tierRank[user?.tier || 'free'] < tierRank[needTier]

  // Fetch lazily per view, cached per subject.
  useEffect(() => {
    if (!ctx || locked || busy) return
    const need = view === 'map' ? !mapData : view === 'swot' ? !swotData : false
    if (!need) return
    setBusy(true)
    setErr(null)
    const req = view === 'map' ? api.insightsMap(items) : api.insightsSwot(items, ctx.label)
    req
      .then((d) => (view === 'map' ? setMapData(d) : setSwotData(d)))
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, view, locked])

  if (!ctx) return null

  const runStress = () => {
    setBusy(true)
    setErr(null)
    api
      .insightsStress(items, scenarioId)
      .then(setStressData)
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false))
  }

  // Dismissing a highlighted proposal keeps it: it moves to the added list.
  const dismissSel = () => {
    if (sel?.isProposal && !added.some((a) => a.ticker === sel.ticker)) {
      setAdded((l) => [...l, sel])
    }
    setSel(null)
  }

  // The graph views are landscape-first: on a portrait phone we rotate the
  // whole canvas so the user flips the phone for the immersive view.
  const rotated = portrait && (view === 'map' || view === 'swot')

  const body = (
    <>
      <header className="pos-header ins-header">
        <button className="pos-back" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="pos-header-info">
          <div className="pos-header-title">Portfolio insights</div>
          <div className="pos-header-sub">{ctx.label}</div>
        </div>
        <div className="menu-tabs ins-tabs">
          {VIEWS.map((v) => (
            <button key={v.id} className={view === v.id ? 'active' : ''} onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      </header>

      <div className="ins-body">
        {locked && (
          <div className="ins-fold ins-locked">
            <div className="menu-note">
              {items.length > 1 ? 'Portfolio insights need the Tailormade subscription.' : 'Stock insights need the Premium subscription.'} 🔒
            </div>
            <button className="upsell-btn" onClick={() => onUpgrade(needTier)}>
              Upgrade to {needTier === 'premium' ? 'Premium' : 'Tailormade'}
            </button>
          </div>
        )}

        {!locked && view === 'map' && (
          <>
            <div className="ins-fold">
              {busy && !mapData && <div className="ins-loading">Placing your {items.length > 1 ? 'portfolio' : 'stock'} on the map…</div>}
              {err && <div className="menu-msg err">{err}</div>}
              {mapData && (
                <>
                  <PolarMap
                    data={mapData}
                    weights={weights}
                    showProposals={showProposals}
                    sel={sel}
                    onSelect={(p) => {
                      if (sel?.isProposal && sel.ticker !== p.ticker && !added.some((a) => a.ticker === sel.ticker)) {
                        setAdded((l) => [...l, sel])
                      }
                      setSel(p)
                    }}
                    onDismiss={dismissSel}
                  />
                  <div className="ins-actions">
                    {!showProposals ? (
                      <button className="menu-primary dark ins-propose" onClick={() => setShowProposals(true)} disabled={!mapData.proposals.length}>
                        ✨ Propose additions
                      </button>
                    ) : (
                      <div className="ins-hint">Tap a faded dot to see why the desk picked it — leave it highlighted-then-dismissed and it lands in your list below. ⌄</div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="ins-added">
              <div className="menu-heading">Added stocks</div>
              {added.length === 0 && <div className="empty-note">Nothing added yet — explore the proposals above.</div>}
              {added.map((a) => (
                <div key={a.ticker} className="added-row">
                  <div className="added-badge" style={{ background: indColor(a.industry) }}>
                    {a.ticker.slice(0, 4)}
                  </div>
                  <div className="added-main">
                    <div className="added-name">
                      {a.name || byTicker[a.ticker]?.n} <small>{a.industry}</small>
                    </div>
                    <div className="added-reason">{a.reason}</div>
                  </div>
                  <button className="added-remove" onClick={() => setAdded((l) => l.filter((x) => x.ticker !== a.ticker))} aria-label="Remove">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {!locked && view === 'swot' && (
          <div className="ins-fold">
            {busy && !swotData && <div className="ins-loading">Drawing the SWOT for {ctx.label}…</div>}
            {err && <div className="menu-msg err">{err}</div>}
            {swotData && <SwotGrid data={swotData} />}
          </div>
        )}

        {!locked && view === 'stress' && (
          <StressView items={items} busy={busy} err={err} data={stressData} scenarioId={scenarioId} onPick={setScenarioId} onRun={runStress} />
        )}
      </div>
    </>
  )

  return (
    <div className="insights-overlay">
      {rotated ? (
        <div className="ins-rotate">
          {body}
          <div className="ins-flip-hint">📱 flip your phone for the real thing</div>
        </div>
      ) : (
        <div className="ins-flat">{body}</div>
      )}
    </div>
  )
}
