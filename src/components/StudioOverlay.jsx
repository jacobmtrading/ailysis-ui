import { useEffect, useMemo, useState } from 'react'
import * as api from '../account'
import LoadingFun from './LoadingFun'
import { UNIVERSE } from '../../api/_lib/universe.js'

const TOOL_LABEL = { map: 'Risk map', swot: 'SWOT', stress: 'Stress test' }

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
  // evaluate
  const [rows, setRows] = useState([{ ticker: '', weightPct: '' }, { ticker: '', weightPct: '' }, { ticker: '', weightPct: '' }])

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

  const pickTab = (t) => {
    setTab(t)
    setUpsell(null)
    setErr(null)
  }

  // Whichever subject the insight tools should act on, derived from the active
  // tab (a searched stock / an entered portfolio) with the last run as fallback.
  const filledRows = rows.filter((r) => r.ticker && r.weightPct)
  const subject = useMemo(() => {
    if (tab === 'analyze' && matches[0])
      return { items: [{ ticker: matches[0].t, weightPct: 100 }], label: `${matches[0].t} — ${matches[0].n}`, need: 'premium' }
    if (tab === 'check' && filledRows.length >= 1)
      return { items: filledRows.map((r) => ({ ticker: r.ticker, weightPct: +r.weightPct })), label: 'My portfolio', need: 'tailormade' }
    if (lastCtx) return { items: lastCtx.items, label: lastCtx.label, need: lastCtx.items.length > 1 ? 'tailormade' : 'premium' }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, matches, rows, lastCtx])

  // Premium insight tools (risk map / SWOT / stress test) for the active subject.
  const openTool = (view) => {
    if (!subject) {
      setErr('Search a stock (Analyze) or enter positions (Check) first, then open an insight tool.')
      return
    }
    if (locked(subject.need)) {
      setUpsell(subject.need)
      return
    }
    setErr(null)
    api.logSession({ name: subject.label, note: TOOL_LABEL[view], ctx: { view, items: subject.items, label: subject.label } })
    setActivity(api.localSessions())
    onOpenInsights({ view, items: subject.items, label: subject.label })
  }

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
        <button className="dr-cell tool" disabled={!subject} onClick={() => openTool('map')}>
          Risk map
        </button>
        <button className="dr-cell tool" disabled={!subject} onClick={() => openTool('swot')}>
          SWOT
        </button>
        <button className="dr-cell tool" disabled={!subject} onClick={() => openTool('stress')}>
          Stress test
        </button>
      </div>
      {!subject && user && (
        <div className="dr-toolhint">Insight tools use a stock you search under Analyze or the positions you enter under Check.</div>
      )}

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
            <button
              className="menu-primary dark"
              disabled={busy}
              onClick={() => tryRun('tailormade', () => api.evaluatePortfolio(filledRows))}
            >
              {busy ? 'The board is deliberating…' : `Evaluate my portfolio${locked('tailormade') ? ' · locked' : ''}`}
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
