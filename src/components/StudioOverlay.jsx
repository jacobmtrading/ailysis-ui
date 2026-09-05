import { useEffect, useMemo, useState } from 'react'
import * as api from '../account'
import LoadingFun from './LoadingFun'
import { UNIVERSE } from '../../api/_lib/universe.js'

const TOOL_LABEL = { map: 'Risk map', swot: 'SWOT', stress: 'Stress test' }
const TOOL_BLURB = {
  map: 'Plots political dependency, momentum and valuation on one polar map — and proposes stocks that fill the gaps.',
  swot: 'Strengths, weaknesses, opportunities and threats, written by the board.',
  stress: 'Pick a scenario and see how each position would hold up.',
}
const IS_TOOL = (t) => t === 'map' || t === 'swot' || t === 'stress'

const SECTORS = ['Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer', 'Industrials', 'Aerospace & Defence', 'Communication']
const THEMES = ['Momentum', 'Value', 'Growth', 'Dividends', 'Picks & Shovels', 'Defensive']
const TIER_RANK = { free: 0, premium: 1, tailormade: 2 }
const TIER_LABEL = { premium: 'Premium', tailormade: 'Tailormade' }

export default function StudioOverlay({ open, user, onOpenChat, onOpenInsights, onUpgrade, onClose }) {
  const [tab, setTab] = useState('analyze')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [upsell, setUpsell] = useState(null)
  const [mine, setMine] = useState([])
  const [activity, setActivity] = useState([])
  const [lastCtx, setLastCtx] = useState(null)

  // analyze
  const [query, setQuery] = useState('')
  // build
  const [timeSpan, setTimeSpan] = useState('medium term (1-3y)')
  const [volatility, setVolatility] = useState('medium')
  const [maxPosPct, setMaxPosPct] = useState(20)
  const [sectors, setSectors] = useState([])
  const [themes, setThemes] = useState([])
  const [assetClass, setAssetClass] = useState('mixed (stocks + ETFs)')
  // evaluate — also the position list the insight tools run on
  const [rows, setRows] = useState([{ ticker: '', weightPct: '' }, { ticker: '', weightPct: '' }, { ticker: '', weightPct: '' }])
  // insight tools: run on a single searched stock or on the entered positions
  const [toolMode, setToolMode] = useState('stock')
  const [pickedStock, setPickedStock] = useState(null)

  useEffect(() => {
    if (open && user) api.myChats().then((d) => setMine(d.chats || [])).catch(() => {})
    if (open) setActivity(api.localSessions())
  }, [open, user])

  const tier = user?.tier || 'free'
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return UNIVERSE.filter((u) => u.t.toLowerCase().startsWith(q) || u.n.toLowerCase().includes(q)).slice(0, 6)
  }, [query])

  // "My sessions" merges server-side board chats with locally-logged insight
  // opens, each tagged with a note of what it was, newest first.
  const sessions = useMemo(() => {
    const fromChats = mine.map((c) => ({
      id: c.id,
      name: c.name,
      time: c.time,
      note: c.source || 'Board discussion',
      open: () => onOpenChat({ ticker: c.ticker, name: c.name, source: c.source, chat: c.messages }),
    }))
    const fromActivity = activity.map((a) => ({
      id: a.id,
      name: a.name,
      time: a.time,
      note: a.note,
      open: () => a.ctx && onOpenInsights(a.ctx),
    }))
    return [...fromChats, ...fromActivity].sort((x, y) => y.time - x.time).slice(0, 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, activity])

  // Whichever subject the insight tools should act on. On a tool tab it comes
  // from that tab's own inputs (a picked stock / the entered positions); from
  // Analyze or Check it follows what is being worked on there.
  const filledRows = rows.filter((r) => r.ticker && r.weightPct)
  const portfolioSubject =
    filledRows.length >= 1
      ? { items: filledRows.map((r) => ({ ticker: r.ticker, weightPct: +r.weightPct })), label: 'My portfolio', need: 'tailormade' }
      : null
  const subject = useMemo(() => {
    if (IS_TOOL(tab)) {
      if (toolMode === 'portfolio') return portfolioSubject
      const s = pickedStock || matches[0]
      return s ? { items: [{ ticker: s.t, weightPct: 100 }], label: `${s.t} — ${s.n}`, need: 'premium' } : null
    }
    if (tab === 'analyze' && matches[0])
      return { items: [{ ticker: matches[0].t, weightPct: 100 }], label: `${matches[0].t} — ${matches[0].n}`, need: 'premium' }
    if (tab === 'check' && portfolioSubject) return portfolioSubject
    if (lastCtx) return { items: lastCtx.items, label: lastCtx.label, need: lastCtx.items.length > 1 ? 'tailormade' : 'premium' }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, toolMode, pickedStock, matches, rows, lastCtx])

  if (!open) return null

  const locked = (need) => TIER_RANK[tier] < TIER_RANK[need]

  const run = async (fn, note) => {
    setBusy(true)
    setErr(null)
    try {
      const out = await fn()
      if (out?.chat) {
        setMine((m) => [out.chat, ...m])
        if (out.chat.positions?.length) setLastCtx({ items: out.chat.positions, label: out.chat.name })
        setActivity(api.localSessions()) // server chat already logs; keep list fresh
        onOpenChat({ ticker: out.chat.ticker, name: out.chat.name, source: out.chat.source, chat: out.chat.messages, live: true })
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  // Free users can play with the inputs, but committing needs the tier.
  const tryRun = (need, fn) => {
    if (locked(need)) {
      setUpsell(need)
      return
    }
    setUpsell(null)
    run(fn)
  }

  const pickTab = (t) => {
    setTab(t)
    setUpsell(null)
    setErr(null)
  }

  // Premium insight tools (risk map / SWOT / stress test) for the active subject.
  const openTool = (view) => {
    if (!subject) return
    if (locked(subject.need)) {
      setUpsell(subject.need)
      return
    }
    setErr(null)
    api.logSession({ name: subject.label, note: TOOL_LABEL[view], ctx: { view, items: subject.items, label: subject.label } })
    setActivity(api.localSessions())
    onOpenInsights({ view, items: subject.items, label: subject.label })
  }

  // Same position entry the portfolio analysis uses — shared with the insight
  // tools so a stress test can be fed a portfolio without running a check first.
  const positionsEditor = (
    <>
      {rows.map((r, i) => (
        <div className="menu-coderow" key={i}>
          <input
            className="menu-input"
            placeholder="Ticker (e.g. AAPL)"
            value={r.ticker}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, ticker: e.target.value.toUpperCase() } : x)))}
          />
          <input
            className="menu-input weight"
            placeholder="%"
            inputMode="numeric"
            value={r.weightPct}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, weightPct: e.target.value.replace(/\D/g, '') } : x)))}
          />
        </div>
      ))}
      <button className="menu-link" onClick={() => setRows([...rows, { ticker: '', weightPct: '' }])}>
        + Add position
      </button>
    </>
  )

  return (
    <div className="studio-overlay">
      <header className="pos-header">
        <button className="pos-back" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="pos-header-info">
          <div className="pos-header-title">Discussion room</div>
          <div className="pos-header-sub">Your personal board sessions</div>
        </div>
      </header>

      <div className="dr-grid">
        <button className={`dr-cell ${tab === 'analyze' ? 'active' : ''}`} onClick={() => pickTab('analyze')}>
          Analyze{locked('premium') ? ' · locked' : ''}
        </button>
        <button className={`dr-cell ${tab === 'build' ? 'active' : ''}`} onClick={() => pickTab('build')}>
          Builder{locked('tailormade') ? ' · locked' : ''}
        </button>
        <button className={`dr-cell ${tab === 'check' ? 'active' : ''}`} onClick={() => pickTab('check')}>
          Check{locked('tailormade') ? ' · locked' : ''}
        </button>
        {Object.entries(TOOL_LABEL).map(([id, label]) => (
          <button key={id} className={`dr-cell tool ${tab === id ? 'active' : ''}`} onClick={() => pickTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="menu-body">
        {!user && <div className="menu-note">Log in first (☰ menu) to use the board studio.</div>}

        {user && tab === 'analyze' && (
          <>
            <div className="menu-heading">Let the board analyze a stock or ETF</div>
            {locked('premium') && (
              <div className="menu-note">Preview — search freely; upgrade to Premium to run the analysis.</div>
            )}
            <input
              className="menu-input"
              placeholder="Search ticker or name (e.g. NVDA)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {matches.map((m) => (
              <button
                key={m.t}
                className="menu-link"
                disabled={busy}
                onClick={() => tryRun('premium', () => api.analyzeStock(m.t))}
              >
                {busy ? '…' : `${m.t} — ${m.n} (${m.type === 'etf' ? 'ETF' : m.ind})`}
                {locked('premium') ? ' · locked' : ''}
              </button>
            ))}
          </>
        )}

        {user && tab === 'build' && (
          <>
            <div className="menu-heading">The board builds a portfolio to your spec</div>
            {locked('tailormade') && (
              <div className="menu-note">Preview — set your criteria; upgrade to Tailormade to build it.</div>
            )}
            <label className="menu-label">Time span</label>
            <select className="menu-input" value={timeSpan} onChange={(e) => setTimeSpan(e.target.value)}>
              <option>short term (&lt;1y)</option>
              <option>medium term (1-3y)</option>
              <option>long term (3y+)</option>
            </select>
            <label className="menu-label">Volatility</label>
            <select className="menu-input" value={volatility} onChange={(e) => setVolatility(e.target.value)}>
              <option>low</option>
              <option>medium</option>
              <option>high</option>
            </select>
            <label className="menu-label">Diversification — max position size: {maxPosPct}%</label>
            <input type="range" min="5" max="50" step="5" value={maxPosPct} onChange={(e) => setMaxPosPct(+e.target.value)} className="menu-range" />
            <label className="menu-label">Preferred sectors</label>
            <div className="chip-row">
              {SECTORS.map((s) => (
                <button key={s} className={`chip ${sectors.includes(s) ? 'on' : ''}`} onClick={() => toggle(sectors, setSectors, s)}>
                  {s}
                </button>
              ))}
            </div>
            <label className="menu-label">Themes</label>
            <div className="chip-row">
              {THEMES.map((t) => (
                <button key={t} className={`chip ${themes.includes(t) ? 'on' : ''}`} onClick={() => toggle(themes, setThemes, t)}>
                  {t}
                </button>
              ))}
            </div>
            <label className="menu-label">Asset class</label>
            <select className="menu-input" value={assetClass} onChange={(e) => setAssetClass(e.target.value)}>
              <option>stocks only</option>
              <option>ETFs only</option>
              <option>mixed (stocks + ETFs)</option>
            </select>
            <button
              className="menu-primary dark"
              disabled={busy}
              onClick={() => tryRun('tailormade', () => api.buildPortfolio({ timeSpan, volatility, maxPosPct, sectors, themes, assetClass }))}
            >
              {busy ? 'The board is working…' : `Build my portfolio${locked('tailormade') ? ' · locked' : ''}`}
            </button>
          </>
        )}

        {user && tab === 'check' && (
          <>
            <div className="menu-heading">The board reviews your own portfolio</div>
            {locked('tailormade') && (
              <div className="menu-note">Preview — enter your positions; upgrade to Tailormade to run the check.</div>
            )}
            {positionsEditor}
            <button
              className="menu-primary dark"
              disabled={busy}
              onClick={() => tryRun('tailormade', () => api.evaluatePortfolio(filledRows))}
            >
              {busy ? 'The board is deliberating…' : `Evaluate my portfolio${locked('tailormade') ? ' · locked' : ''}`}
            </button>
          </>
        )}

        {user && IS_TOOL(tab) && (
          <>
            <div className="menu-heading">{TOOL_LABEL[tab]}</div>
            <div className="menu-note">{TOOL_BLURB[tab]}</div>

            <label className="menu-label">Run it on</label>
            <div className="chip-row">
              <button className={`chip ${toolMode === 'stock' ? 'on' : ''}`} onClick={() => setToolMode('stock')}>
                A single stock
              </button>
              <button className={`chip ${toolMode === 'portfolio' ? 'on' : ''}`} onClick={() => setToolMode('portfolio')}>
                My portfolio
              </button>
            </div>

            {toolMode === 'stock' ? (
              <>
                <input
                  className="menu-input"
                  placeholder="Search ticker or name (e.g. NVDA)"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPickedStock(null)
                  }}
                />
                {matches.map((m) => (
                  <button
                    key={m.t}
                    className={`menu-link ${pickedStock?.t === m.t ? 'picked' : ''}`}
                    onClick={() => setPickedStock(m)}
                  >
                    {m.t} — {m.n} ({m.type === 'etf' ? 'ETF' : m.ind})
                  </button>
                ))}
              </>
            ) : (
              positionsEditor
            )}

            <div className="dr-subjecthint">
              {subject
                ? `Ready for ${subject.label}.`
                : toolMode === 'stock'
                  ? 'Search a stock above, then open the tool.'
                  : 'Enter at least one position with a weight, then open the tool.'}
            </div>
            <button className="menu-primary dark" disabled={!subject} onClick={() => openTool(tab)}>
              Open {TOOL_LABEL[tab]}
              {subject && locked(subject.need) ? ' · locked' : ''}
            </button>
          </>
        )}

        {busy && <LoadingFun label="The board is convening…" />}

        {upsell && (
          <button className="upsell-btn" onClick={() => onUpgrade(upsell)}>
            Upgrade to {TIER_LABEL[upsell]}
          </button>
        )}
        {err && <div className="menu-msg err">{err}</div>}

        {user && sessions.length > 0 && (
          <div className="menu-section">
            <div className="menu-heading">My sessions</div>
            {sessions.map((s) => (
              <button key={s.id} className="menu-link ms-row" onClick={s.open}>
                <span className="ms-name">
                  {s.name} · {new Date(s.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="ms-note">{s.note}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
