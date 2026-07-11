import { useEffect, useState } from 'react'
import * as api from '../account'

export default function AdminOverlay({ open, onClose }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [newCode, setNewCode] = useState('')
  const [newTier, setNewTier] = useState('premium')
  const [busy, setBusy] = useState(false)

  const refresh = () =>
    api
      .adminList()
      .then((d) => {
        setData(d)
        setErr(null)
      })
      .catch((e) => setErr(e.message))

  useEffect(() => {
    if (open) refresh()
  }, [open])

  if (!open) return null

  const act = async (fn) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      await refresh()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-overlay">
      <header className="pos-header">
        <button className="pos-back" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="pos-header-info">
          <div className="pos-header-title">Admin</div>
          <div className="pos-header-sub">
            {data ? `${data.users.length} accounts · ${data.codes.length} codes` : 'loading…'}
          </div>
        </div>
      </header>

      <div className="menu-body">
        {err && <div className="menu-msg err">{err}</div>}

        <div className="menu-heading">Accounts</div>
        {data?.users.map((u) => (
          <div className="admin-row" key={u.username}>
            <div className="admin-user">
              <div className="admin-name">
                {u.email || u.username}
                {u.role === 'admin' && <span className="offer-tag">· admin</span>}
                {!u.emailVerified && <span className="offer-tag">· unverified</span>}
              </div>
              <div className="admin-sub">
                since {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
              </div>
            </div>
            <select
              className="menu-input tier-select"
              value={u.tier}
              disabled={busy}
              onChange={(e) => act(() => api.adminSetTier(u.username, e.target.value))}
            >
              <option value="free">Free</option>
              <option value="premium">Premium</option>
              <option value="tailormade">Tailormade</option>
            </select>
          </div>
        ))}

        <div className="menu-heading" style={{ marginTop: 18 }}>
          Friends & family codes
        </div>
        <div className="menu-coderow">
          <input
            className="menu-input code"
            placeholder="4 digits"
            inputMode="numeric"
            maxLength={4}
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.replace(/\D/g, ''))}
          />
          <select className="menu-input tier-select" value={newTier} onChange={(e) => setNewTier(e.target.value)}>
            <option value="premium">Premium</option>
            <option value="tailormade">Tailormade</option>
          </select>
          <button
            className="menu-primary"
            disabled={busy || newCode.length !== 4}
            onClick={() => act(() => api.adminAddCode(newCode, newTier)).then(() => setNewCode(''))}
          >
            Add
          </button>
        </div>
        {data?.codes.map((c) => (
          <div className="admin-row" key={c.code}>
            <div className="admin-user">
              <div className="admin-name code-mono">{c.code}</div>
              <div className="admin-sub">
                {c.tier} · used {c.uses}×
              </div>
            </div>
            <button className="menu-logout" disabled={busy} onClick={() => act(() => api.adminDelCode(c.code))}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
