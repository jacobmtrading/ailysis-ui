import { useEffect, useState } from 'react'
import * as api from '../account'

const TIER_LABEL = { free: 'Free', premium: 'Premium', tailormade: 'Tailormade' }
const TIER_RANK = { free: 0, premium: 1, tailormade: 2 }
const OFFER_CONTENT = {
  premium: [
    { name: 'Personalized board analysis', desc: 'Let the board debate any stock or ETF you pick and give you a verdict.' },
  ],
  tailormade: [
    { name: 'Personalized board analysis', tag: 'Premium' },
    {
      name: 'Portfolio builder',
      desc: 'Build a portfolio based on:',
      list: [
        'Time span',
        'Volatility range',
        'Diversification (max position size)',
        'Preferred sectors',
        'Themes (momentum, value, picks & shovels…)',
        'Asset class',
      ],
    },
    {
      name: 'Portfolio check',
      desc: 'Submit your own portfolio and the board evaluates it — strengths, risks and a 1–10 score.',
    },
  ],
}
const INTERVAL_SUFFIX = { month: '/mo', year: '/yr', lifetime: ' once' }

function priceLabel(p) {
  const amt = (p.amount / 100).toLocaleString(undefined, { style: 'currency', currency: (p.currency || 'eur').toUpperCase() })
  return `${amt}${INTERVAL_SUFFIX[p.interval] || ''}`
}

export default function MenuOverlay({ open, user, onUser, expandTier, onClose, onOpenStudio, onOpenAdmin }) {
  const [mode, setMode] = useState('login') // login | register
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [plans, setPlans] = useState(null)
  const [expandedTier, setExpandedTier] = useState(null)

  useEffect(() => {
    if (open && user && user.tier !== 'tailormade' && !plans) {
      api.plans().then((d) => setPlans(d.plans || [])).catch(() => setPlans([]))
    }
  }, [open, user, plans])

  if (!open) return null

  const run = async (fn, okMsg) => {
    setBusy(true)
    setMsg(null)
    try {
      const out = await fn()
      if (okMsg) setMsg({ ok: true, text: okMsg })
      return out
    } catch (e) {
      setMsg({ ok: false, text: e.message })
      return null
    } finally {
      setBusy(false)
    }
  }

  const submitAuth = async () => {
    const fn = mode === 'login' ? api.login : api.register
    const out = await run(() => fn(username.trim(), password))
    if (out?.token) {
      api.setToken(out.token)
      onUser(out.user)
      setPassword('')
    }
  }

  const submitCode = async () => {
    const out = await run(() => api.redeemCode(code.trim()), 'Code applied!')
    if (out?.user) onUser(out.user)
    setCode('')
  }

  const goCheckout = async (plan) => {
    const out = await run(() => api.checkout(plan))
    if (out?.url) window.location.href = out.url
  }

  const doLogout = async () => {
    await run(() => api.logout())
    api.setToken(null)
    onUser(null)
    setMsg(null)
  }

  return (
    <div className="menu-overlay">
      <header className="pos-header">
        <button className="pos-back" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="pos-header-title">{user ? 'Account' : 'Log in'}</div>
      </header>

      <div className="menu-body">
        {!user && (
          <>
            <div className="menu-tabs">
              <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
                Log in
              </button>
              <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
                Create account
              </button>
            </div>
            <input
              className="menu-input"
              placeholder="Username"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              className="menu-input"
              placeholder="Password (min. 6 characters)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="menu-primary" disabled={busy || !username || !password} onClick={submitAuth}>
              {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
            <div className="menu-note">No email needed — just a username and password.</div>
            <div className="menu-note">Have a friends & family code? Log in first, then redeem it here.</div>
          </>
        )}

        {user && (
          <>
            <div className="menu-userrow">
              <div className="menu-avatar">{user.username.slice(0, 2).toUpperCase()}</div>
              <div className="menu-userinfo">
                <div className="menu-username">@{user.username}</div>
                <span className={`tier-chip tier-${user.tier}`}>{TIER_LABEL[user.tier] || user.tier}</span>
              </div>
              <button className="menu-logout" onClick={doLogout}>
                Log out
              </button>
            </div>

            <div className="menu-section">
              <div className="menu-heading">Tools</div>
              <button className="menu-link" onClick={onOpenStudio}>
                Personalized analysis {user.tier === 'free' ? '🔒' : ''}
              </button>
              <button className="menu-link" onClick={onOpenStudio}>
                Portfolio builder {user.tier !== 'tailormade' ? '🔒' : ''}
              </button>
              <button className="menu-link" onClick={onOpenStudio}>
                Check my portfolio {user.tier !== 'tailormade' ? '🔒' : ''}
              </button>
            </div>

            <div className="menu-section">
              <div className="menu-heading">Code?</div>
              <div className="menu-coderow">
                <input
                  className="menu-input code"
                  placeholder="4-digit code"
                  inputMode="numeric"
                  maxLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <button className="menu-primary" disabled={busy || code.length !== 4} onClick={submitCode}>
                  Redeem
                </button>
              </div>
            </div>

            {user.tier !== 'tailormade' && (
              <div className="menu-section">
                {['premium', 'tailormade']
                  .filter((t) => TIER_RANK[t] > TIER_RANK[user.tier])
                  .map((tierKey) => {
                    const open = expandedTier === tierKey
                    const group = plans ? plans.filter((p) => p.tier === tierKey) : []
                    return (
                      <div className="plan-group" key={tierKey}>
                        <div className="plan-tier-name">{TIER_LABEL[tierKey]}</div>
                        <div className="tier-offer">
                          {OFFER_CONTENT[tierKey].map((f, i) => (
                            <div className="offer-feature" key={i}>
                              <div className="offer-name">
                                {f.name}
                                {f.tag && <span className="offer-tag"> ({f.tag})</span>}
                              </div>
                              {f.desc && <div className="offer-desc">{f.desc}</div>}
                              {f.list && (
                                <ul className="offer-list">
                                  {f.list.map((x, j) => (
                                    <li key={j}>{x}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                        {!open ? (
                          <button
                            className={`menu-primary ${tierKey === 'tailormade' ? 'dark' : ''}`}
                            onClick={() => setExpandedTier(tierKey)}
                          >
                            Upgrade to {TIER_LABEL[tierKey]}
                          </button>
                        ) : plans === null ? (
                          <div className="menu-note">Loading plans…</div>
                        ) : group.length === 0 ? (
                          <div className="menu-note">Plans aren't configured yet (add STRIPE_SECRET_KEY in Vercel).</div>
                        ) : (
                          group.map((p) => (
                            <button key={p.key} className="plan-btn" disabled={busy} onClick={() => goCheckout(p.key)}>
                              <span className="plan-name">{p.name}</span>
                              <span className="plan-price">{priceLabel(p)}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )
                  })}
              </div>
            )}

            {user.role === 'admin' && (
              <div className="menu-section">
                <button className="menu-link" onClick={onOpenAdmin}>
                  Admin panel
                </button>
              </div>
            )}
          </>
        )}

        {msg && <div className={`menu-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      </div>
    </div>
  )
}
