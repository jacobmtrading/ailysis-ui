import { useEffect, useMemo, useState } from 'react'
import * as api from '../account'
import { filledRows } from '../lab'
import LoadingFun from './LoadingFun'

// Every tool in the Lab, in grid order. `need` is the tier a run needs —
// insight tools depend on the subject (one stock = premium, a portfolio = tailormade).
const TOOLS = [
  { id: 'check', label: 'Check', need: 'tailormade' },
  { id: 'map', label: 'Risk map' },
  { id: 'swot', label: 'SWOT' },
  { id: 'stress', label: 'Stress test' },
  { id: 'analyze', label: 'Analyze', need: 'premium' },
  { id: 'build', label: 'Builder', need: 'tailormade' },
]
const TOOL_LABEL = Object.fromEntries(TOOLS.map((t) => [t.id, t.label]))
const TOOL_BLURB = {
  check: 'The board reviews your holdings and hands back strengths, risks and a 1–10 score.',
  map: 'Plots political dependency, momentum and valuation on one polar map — and proposes stocks that fill the gaps.',
  swot: 'Strengths, weaknesses, opportunities and threats, written by the board.',
  stress: 'Pick a scenario and see how each position would hold up.',
  analyze: 'The agent board debates one stock and hands you a verdict.',
  build: 'Not using what you entered — the board assembles a new portfolio to your spec.',
}
const IS_TOOL = (t) => t === 'map' || t === 'swot' || t === 'stress'

const SECTORS = ['Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer', 'Industrials', 'Aerospace & Defence', 'Communication', 'Materials', 'Utilities', 'Real Estate']
const THEMES = ['Momentum', 'Value', 'Growth', 'Dividends', 'Picks & Shovels', 'Defensive']
const TIER_RANK = { free: 0, premium: 1, tailormade: 2 }
const TIER_LABEL = { premium: 'Premium', tailormade: 'Tailormade' }

const optionLabel = (m) => (m.unlisted ? `${m.t} — ${m.n}` : `${m.t} — ${m.n} (${m.type === 'etf' ? 'ETF' : m.ind})`)
const subjectLabel = (m) => (m.unlisted ? m.t : `${m.t} — ${m.n}`)

export default function LabOverlay({ open, user, initialTab, lab, onLab, onOpenChat, onOpenInsights, onUpgrade, onClose }) {
  const [tab, setTab] = useState('check')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [upsell, setUpsell] = useState(null)
  const [mine, setMine] = useState([])
  const [activity, setActivity] = useState([])
  // The stock list (thousands of names) is its own chunk, fetched when the Lab opens.
  const [uni, setUni] = useState(null)
  // Subject editor: open until something has been entered, then folded to a summary.
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  // Which position row's ticker box is focused — it gets the same suggestion list as the stock search.
  const [activeRow, setActiveRow] = useState(null)
  // Analyze runs on one ticker — in portfolio mode, the position picked here.
  const [analyzePick, setAnalyzePick] = useState(null)
  // build
  const [timeSpan, setTimeSpan] = useState('medium term (1-3y)')
  const [volatility, setVolatility] = useState('medium')
  const [maxPosPct, setMaxPosPct] = useState(20)
  const [sectors, setSectors] = useState([])
  const [themes, setThemes] = useState([])
  const [assetClass, setAssetClass] = useState('mixed (stocks + ETFs)')

  const positions = filledRows(lab)
  const subject = useMemo(() => {
    if (lab.mode === 'stock') {
      return lab.stock ? { items: [{ ticker: lab.stock.t, weightPct: 100 }], label: subjectLabel(lab.stock), need: 'premium' } : null
    }
    return positions.length
      ? {
          items: positions,
          label: `My portfolio (${positions.map((r) => `${r.ticker} ${r.weightPct}%`).join(', ')})`,
          need: 'tailormade',
        }
      : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lab])

  // Opened from a feature card: land on that tool, with the editor open only if nothing is entered yet.
  useEffect(() => {
    if (open) {
      setTab(initialTab && TOOL_LABEL[initialTab] ? initialTab : 'check')
      setUpsell(null)
      setErr(null)
      setEditing(!subject)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab])

  useEffect(() => {
    if (open && user) api.myChats().then((d) => setMine(d.chats || [])).catch(() => {})
    if (open) setActivity(api.localSessions())
  }, [open, user])

  useEffect(() => {
    if (open && !uni) import('../../api/_lib/universe.js').then((m) => setUni(m)).catch(() => {})
  }, [open, uni])

  const tier = user?.tier || 'free'
  const matches = useMemo(() => {
    if (!uni || !query.trim()) return []
    const found = uni.searchUniverse(query, 8)
    // Not in our list? Any traded symbol can still be looked up live — offered
    // when the query looks like a ticker and isn't just the start of a name ("nestle").
    const typed = query.trim().toUpperCase().replace('.', '-')
    const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const isName = found.some((m) => fold(m.n).startsWith(fold(query.trim())))
    if (/^[A-Z][A-Z0-9]{0,5}(-[A-Z])?$/.test(typed) && !uni.byTicker[typed] && !isName) {
      found.push({ t: typed, n: 'not in our list, look it up live', unlisted: true })
    }
    return found
  }, [query, uni])

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

  if (!open) return null

  const locked = (need) => TIER_RANK[tier] < TIER_RANK[need]
  const toolNeed = (id) => TOOLS.find((t) => t.id === id).need || subject?.need || 'premium'

  const run = async (fn) => {
    setBusy(true)
    setErr(null)
    try {
      const out = await fn()
      if (out?.chat) {
        setMine((m) => [out.chat, ...m])
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

  // Premium insight tools (risk map / SWOT / stress test) for the Lab's subject.
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

  const setMode = (mode) => {
    onLab({ ...lab, mode })
    setAnalyzePick(null)
    if (mode === 'stock' ? !lab.stock : !positions.length) setEditing(true)
  }

  const searchHint = query.trim() && (!uni ? 'Loading the stock list…' : !matches.length ? 'No match — try the ticker symbol.' : null)

  // Position entry: each ticker box suggests matches while typing; picking one
  // fills the ticker and shows the company name underneath, so it's clear the
  // entry was understood.
  const rows = lab.rows
  const setRows = (next) => onLab({ ...lab, rows: next })
  const setRow = (i, patch) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const rowSuggestions = (r) => {
    if (!uni || !r.ticker.trim() || r.picked) return []
    return uni.searchUniverse(r.ticker, 5)
  }
  const totalWeight = positions.reduce((a, p) => a + p.weightPct, 0)

  const positionsEditor = (
    <>
      {rows.map((r, i) => {
        const known = uni && r.ticker && uni.byTicker[r.ticker]
        const suggestions = activeRow === i ? rowSuggestions(r) : []
        return (
          <div className="pos-entry" key={i}>
            <div className="menu-coderow">
              <input
                className="menu-input"
                placeholder="Ticker or name (e.g. AAPL, Siemens)"
                autoCorrect="off"
                spellCheck={false}
                value={r.ticker}
                onFocus={() => setActiveRow(i)}
                onBlur={() => setActiveRow(null)}
                onChange={(e) => setRow(i, { ticker: e.target.value.toUpperCase(), picked: false })}
              />
              <input
                className="menu-input weight"
                placeholder="%"
                inputMode="numeric"
                value={r.weightPct}
                onChange={(e) => setRow(i, { weightPct: e.target.value.replace(/\D/g, '') })}
              />
            </div>
            {suggestions.length > 0 && (
              <div className="pos-suggest">
                {suggestions.map((m) => (
                  <button
                    key={m.t}
                    className="menu-link"
                    // Keep focus in the input so the list doesn't vanish before the tap lands.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setRow(i, { ticker: m.t, picked: true })
                      setActiveRow(null)
                    }}
                  >
                    {optionLabel(m)}
                  </button>
                ))}
              </div>
            )}
            {activeRow === i && r.ticker.trim() && !r.picked && !uni && <div className="pos-entry-note">Loading the stock list…</div>}
            {activeRow === i && uni && r.ticker.trim() && !r.picked && !suggestions.length && (
              <div className="pos-entry-note">No match — the ticker will be looked up live.</div>
            )}
            {activeRow !== i && known && <div className="pos-entry-note ok">✓ {known.n}</div>}
            {activeRow !== i && uni && r.ticker.trim() && !known && (
              <div className="pos-entry-note">Not in our list — {r.ticker} will be looked up live.</div>
            )}
          </div>
        )
      })}
      <button className="menu-link" onClick={() => setRows([...rows, { ticker: '', weightPct: '' }])}>
        + Add position
      </button>
    </>
  )

  const stockSearch = (
    <>
      <input
        className="menu-input"
        placeholder="Search any stock by ticker or name (e.g. NVDA, Siemens)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {searchHint && <div className="menu-note">{searchHint}</div>}
      {matches.map((m) => (
        <button
          key={m.t}
          className={`menu-link ${lab.stock?.t === m.t ? 'picked' : ''}`}
          onClick={() => {
            onLab({ ...lab, stock: m })
            setQuery('')
            setEditing(false)
          }}
        >
          {optionLabel(m)}
        </button>
      ))}
    </>
  )

  // What the Lab is working on, folded down to one glanceable card.
  const subjectSummary =
    lab.mode === 'stock' ? (
      <div className="lab-summary">
        <span className="lab-chip big">{lab.stock.t}</span>
        <span className="lab-summary-name">{lab.stock.unlisted ? 'Looked up live' : lab.stock.n}</span>
      </div>
    ) : (
      <>
        <div className="lab-summary">
          {positions.map((p) => (
            <span key={p.ticker} className="lab-chip">
              {p.ticker} <b>{p.weightPct}%</b>
            </span>
          ))}
        </div>
        <div className={`lab-total ${totalWeight === 100 ? 'ok' : ''}`}>
          {positions.length} position{positions.length === 1 ? '' : 's'} · {totalWeight}% allocated
          {totalWeight !== 100 ? ' — weights are used as given' : ''}
        </div>
      </>
    )

  const toolPanel = (
    <>
      <div className="menu-heading">{TOOL_LABEL[tab]}</div>
      <div className="menu-note">{TOOL_BLURB[tab]}</div>

      {IS_TOOL(tab) && (
        <button className="menu-primary dark" disabled={!subject} onClick={() => openTool(tab)}>
          {subject ? `Open ${TOOL_LABEL[tab]} on ${lab.mode === 'stock' ? lab.stock.t : 'my portfolio'}` : `Enter your ${lab.mode === 'stock' ? 'stock' : 'portfolio'} first`}
          {subject && locked(subject.need) ? ' · locked' : ''}
        </button>
      )}

      {tab === 'check' &&
        (lab.mode === 'stock' ? (
          <>
            <div className="dr-subjecthint">The check reviews a whole portfolio, not a single stock.</div>
            <button className="menu-primary dark" onClick={() => setMode('portfolio')}>
              Switch to my portfolio
            </button>
          </>
        ) : (
          <button
            className="menu-primary dark"
            disabled={busy || !positions.length}
            onClick={() => tryRun('tailormade', () => api.evaluatePortfolio(positions))}
          >
            {busy ? 'The board is deliberating…' : positions.length ? `Evaluate my portfolio${locked('tailormade') ? ' · locked' : ''}` : 'Enter your portfolio first'}
          </button>
        ))}

      {tab === 'analyze' &&
        (() => {
          const ticker = lab.mode === 'stock' ? lab.stock?.t : analyzePick
          return (
            <>
              {lab.mode === 'portfolio' && positions.length > 0 && (
                <>
                  <label className="menu-label">Which position?</label>
                  <div className="chip-row">
                    {positions.map((p) => (
                      <button key={p.ticker} className={`chip ${analyzePick === p.ticker ? 'on' : ''}`} onClick={() => setAnalyzePick(p.ticker)}>
                        {p.ticker}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button className="menu-primary dark" disabled={busy || !ticker} onClick={() => tryRun('premium', () => api.analyzeStock(ticker))}>
                {busy
                  ? 'The board is convening…'
                  : ticker
                    ? `Let the board analyze ${ticker}${locked('premium') ? ' · locked' : ''}`
                    : lab.mode === 'portfolio' && positions.length
                      ? 'Pick a position above'
                      : `Enter your ${lab.mode === 'stock' ? 'stock' : 'portfolio'} first`}
              </button>
            </>
          )
        })()}

      {tab === 'build' && (
        <>
          {locked('tailormade') && <div className="menu-note">Preview — set your criteria; upgrade to Tailormade to build it.</div>}
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

      {busy && <LoadingFun label="The board is convening…" />}

      {upsell && (
        <button className="upsell-btn" onClick={() => onUpgrade(upsell)}>
          Upgrade to {TIER_LABEL[upsell]}
        </button>
      )}
      {err && <div className="menu-msg err">{err}</div>}
    </>
  )

  return (
    <div className="studio-overlay lab-overlay">
      <header className="pos-header">
        <button className="pos-back" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="pos-header-info">
          <div className="pos-header-title">The Lab</div>
          <div className="pos-header-sub">One dashboard for all the tools</div>
        </div>
      </header>

      <div className="menu-body lab-body">
        {!user && <div className="menu-note">Log in first (☰ menu) to use the Lab.</div>}

        {user && (
          <>
            <section className="lab-card lab-subject">
              <div className="lab-step">
                <span>1</span> Enter it once
              </div>
              <div className="chip-row">
                <button className={`chip ${lab.mode === 'portfolio' ? 'on' : ''}`} onClick={() => setMode('portfolio')}>
                  My portfolio
                </button>
                <button className={`chip ${lab.mode === 'stock' ? 'on' : ''}`} onClick={() => setMode('stock')}>
                  A single stock
                </button>
              </div>

              {editing || !subject ? (
                <>
                  {lab.mode === 'stock' ? stockSearch : positionsEditor}
                  {subject && (
                    <button className="menu-primary dark" onClick={() => setEditing(false)}>
                      Done — use this {lab.mode === 'stock' ? 'stock' : 'portfolio'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  {subjectSummary}
                  <button className="menu-linkbtn lab-edit" onClick={() => setEditing(true)}>
                    Edit {lab.mode === 'stock' ? 'stock' : 'positions'}
                  </button>
                </>
              )}
              <div className="lab-remember">Remembered on this device — every tool in the Lab runs on it.</div>
            </section>

            <section className="lab-card lab-tools">
              <div className="lab-step">
                <span>2</span> Run any tool on it
              </div>
              <div className="dr-grid lab-grid">
                {TOOLS.map((t) => (
                  <button key={t.id} className={`dr-cell ${tab === t.id ? 'active' : ''}`} onClick={() => pickTab(t.id)}>
                    {t.label}
                    {locked(toolNeed(t.id)) ? ' 🔒' : ''}
                  </button>
                ))}
              </div>
              {toolPanel}
            </section>

            {sessions.length > 0 && (
              <section className="lab-card lab-sessions">
                <div className="menu-heading">My sessions</div>
                {sessions.map((s) => (
                  <button key={s.id} className="menu-link ms-row" onClick={s.open}>
                    <span className="ms-name">
                      {s.name} · {new Date(s.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="ms-note">{s.note}</span>
                  </button>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
