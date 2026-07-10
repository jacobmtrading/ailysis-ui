// Client-side auth + account API. Session token lives in localStorage.
const KEY = 'ailysis_token'

export const getToken = () => localStorage.getItem(KEY)
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY))

async function call(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const register = (username, password) =>
  call('/api/auth', { method: 'POST', body: { action: 'register', username, password } })
export const login = (username, password) =>
  call('/api/auth', { method: 'POST', body: { action: 'login', username, password } })
export const logout = () => call('/api/auth', { method: 'POST', body: { action: 'logout' } })
export const me = () => call('/api/auth')
export const redeemCode = (code) => call('/api/auth', { method: 'POST', body: { action: 'code', code } })

export const plans = () => call('/api/stripe')
export const checkout = (plan) => call('/api/stripe', { method: 'POST', body: { action: 'checkout', plan } })
export const confirmCheckout = (sessionId) =>
  call('/api/stripe', { method: 'POST', body: { action: 'confirm', sessionId } })

export const myChats = () => call('/api/studio')
export const analyzeStock = (ticker) => call('/api/studio', { method: 'POST', body: { action: 'analyze', ticker } })
export const buildPortfolio = (spec) => call('/api/studio', { method: 'POST', body: { action: 'build', spec } })
export const evaluatePortfolio = (positions) =>
  call('/api/studio', { method: 'POST', body: { action: 'evaluate', positions } })

export const adminList = () => call('/api/admin')
export const adminSetTier = (username, tier) =>
  call('/api/admin', { method: 'POST', body: { action: 'setTier', username, tier } })
export const adminAddCode = (code, tier) =>
  call('/api/admin', { method: 'POST', body: { action: 'addCode', code, tier } })
export const adminDelCode = (code) => call('/api/admin', { method: 'POST', body: { action: 'delCode', code } })
