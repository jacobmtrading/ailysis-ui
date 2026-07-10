import { useEffect, useMemo, useState } from 'react'
import * as api from '../account'
import { UNIVERSE } from '../../api/_lib/universe.js'

const SECTORS = ['Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer', 'Industrials', 'Aerospace & Defence', 'Communication']
const THEMES = ['Momentum', 'Value', 'Growth', 'Dividends', 'Picks & Shovels', 'Defensive']
const TIER_RANK = { free: 0, premium: 1, tailormade: 2 }

export default function StudioOverlay({ open, user, onOpenChat, onClose }) {
  const [tab, setTab] = useState('analyze')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [mine, setMine] = useState([])

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
  }, [open, user])

  const tier = user?.tier || 'free'
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return UNIVERSE.filter((u) => u.t.toLowerCase().startsWith(q) || u.n.toLowerCase().includes(q)).slice(0, 6)
  }, [query])

  if (!open) return null

  const locked = (need) => TIER_RANK[tier] < TIER_RANK[need]

  const run = async (fn) => {
    setBusy(true)
    setErr(null)
    try {
      const out = await fn()
      if (out?.chat) {
        setMine((m) => [out.chat, ...m])
        onOpenChat({ ticker: out.chat.ticker, name: out.chat.name, source: out.chat.source, chat: out.chat.messages })
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <div className="studio-overlay">
      <header className="pos-header">
        <button className="pos-back" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="pos-header-info">
          <div className="pos-header-title">Board studio</div>
          <div className="pos-header-sub">Your personal board sessions</div>
        </div>
      </header>

      <div className="menu-tabs studio-tabs">
        <button className={tab === 'analyze' ? 'active' : ''} onClick={() => setTab('analyze')}>
          Analyze {locked('premium') && '🔒'}
        </button>
        <button className={tab === 'build' ? 'active' : ''} onClick={() => setTab('build')}>
          Builder {locked('tailormade') && '🔒'}
        </button>
        <button className={tab === 'check' ? 'active' : ''} onClick={() => setTab('check')}>
          Check {locked('tailormade') && '🔒'}
        </button>
      </div>

      <div className="menu-body">
        {!user && <div className="menu-note">Log in first (☰ menu) to use the board studio.</div>}

        {user && tab === 'analyze' && (
          <>
            <div className="menu-heading">Let the board analyze a stock or ETF</div>
            {locked('premium') ? (
              <div className="menu-note">🔒 Personalized analysis needs a Premium subscription — upgrade in the ☰ menu.</div>
            ) : (
              <>
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
                    onClick={() => run(() => api.analyzeStock(m.t))}
                  >
                    {busy ? '…' : `▶︎ ${m.t} — ${m.n} (${m.type === 'etf' ? 'ETF' : m.ind})`}
                  </button>
                ))}
              </>
            )}
          </>
        )}

        {user && tab === 'build' && (
          <>
            <div className="menu-heading">The board builds a portfolio to your spec</div>
            {locked('tailormade') ? (
              <div className="menu-note">🔒 The portfolio builder needs the Tailormade subscription — upgrade in the ☰ menu.</div>
            ) : (
              <>
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
                  onClick={() => run(() => api.buildPortfolio({ timeSpan, volatility, maxPosPct, sectors, themes, assetClass }))}
                >
                  {busy ? 'The board is working…' : '🧱 Build my portfolio'}
                </button>
              </>
            )}
          </>
        )}

        {user && tab === 'check' && (
          <>
            <div className="menu-heading">The board reviews your own portfolio</div>
            {locked('tailormade') ? (
              <div className="menu-note">🔒 The portfolio check needs the Tailormade subscription — upgrade in the ☰ menu.</div>
            ) : (
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
                <button
                  className="menu-primary dark"
                  disabled={busy}
                  onClick={() => run(() => api.evaluatePortfolio(rows.filter((r) => r.ticker && r.weightPct)))}
                >
                  {busy ? 'The board is deliberating…' : '🩺 Evaluate my portfolio'}
                </button>
              </>
            )}
          </>
        )}

        {err && <div className="menu-msg err">{err}</div>}

        {user && mine.length > 0 && (
          <div className="menu-section">
            <div className="menu-heading">My sessions</div>
            {mine.slice(0, 10).map((c) => (
              <button
                key={c.id}
                className="menu-link"
                onClick={() => onOpenChat({ ticker: c.ticker, name: c.name, source: c.source, chat: c.messages })}
              >
                💬 {c.name} · {new Date(c.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
