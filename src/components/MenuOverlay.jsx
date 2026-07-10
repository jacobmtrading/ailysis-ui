import { useState } from 'react'
import * as api from '../account'

const TIER_LABEL = { free: 'Free', premium: 'Premium', tailormade: 'Tailormade' }

export default function MenuOverlay({ open, user, onUser, onClose, onOpenStudio, onOpenAdmin }) {
  const [mode, setMode] = useState('login') // login | register
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

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
    const out = await run(() => api.redeemCode(code.trim()), 'Code applied! 🎉')
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

            {user.tier !== 'tailormade' && (
              <div className="menu-section">
                <div className="menu-heading">Subscription</div>
                {user.tier === 'free' && (
                  <button className="menu-primary" disabled={busy} onClick={() => goCheckout('premium')}>
                    Upgrade to Premium
                  </button>
                )}
                <button className="menu-primary dark" disabled={busy} onClick={() => goCheckout('tailormade')}>
                  Upgrade to Tailormade
                </button>
                <div className="menu-note">Premium: personalized board analyses. Tailormade: + portfolio builder & portfolio check.</div>
              </div>
            )}

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

            <div className="menu-section">
              <div className="menu-heading">Board studio</div>
              <button className="menu-link" onClick={onOpenStudio}>
                🎯 Personalized analysis {user.tier === 'free' ? '🔒' : ''}
              </button>
              <button className="menu-link" onClick={onOpenStudio}>
                🧱 Portfolio builder {user.tier !== 'tailormade' ? '🔒' : ''}
              </button>
              <button className="menu-link" onClick={onOpenStudio}>
                🩺 Check my portfolio {user.tier !== 'tailormade' ? '🔒' : ''}
              </button>
            </div>

            {user.role === 'admin' && (
              <div className="menu-section">
                <button className="menu-link" onClick={onOpenAdmin}>
                  🛠 Admin panel
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
