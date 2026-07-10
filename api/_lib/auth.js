// Users, sessions, codes — stored in Upstash Redis. No email, just
// username + password (scrypt-hashed). Sessions are random tokens with TTL.
import crypto from 'node:crypto'
import { getJSON, setJSON } from './redis.js'

const USERS_KEY = 'ailysis:users'
const SESS_PREFIX = 'ailysis:sess:'
const SESS_TTL_S = 30 * 86400 // 30 days

export const TIER_RANK = { free: 0, premium: 1, tailormade: 2 }

// ---- low-level redis cmd (reuse the pipeline endpoint) ----
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
async function cmd(...args) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`Redis error ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`Redis: ${data.error}`)
  return data.result
}

// ---- password hashing ----
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  const check = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'))
}

// ---- user store: { users: { username: {...} }, codes: { '1234': {...} } } ----
export async function loadUsers() {
  return (await getJSON(USERS_KEY)) || { users: {}, codes: {} }
}

export async function saveUsers(db) {
  await setJSON(USERS_KEY, db)
}

export function validUsername(u) {
  return typeof u === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(u)
}

export function isAdmin(user) {
  return user?.role === 'admin'
}

export function adminUsername() {
  return (process.env.ADMIN_USERNAME || '').trim().toLowerCase()
}

// ---- sessions ----
export async function createSession(username) {
  const token = crypto.randomBytes(24).toString('hex')
  await cmd('SET', SESS_PREFIX + token, JSON.stringify({ u: username }), 'EX', String(SESS_TTL_S))
  return token
}

export async function destroySession(token) {
  if (token) await cmd('DEL', SESS_PREFIX + token)
}

export async function sessionUser(req) {
  const auth = req.headers?.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const raw = await cmd('GET', SESS_PREFIX + token)
  if (!raw) return null
  try {
    const { u } = JSON.parse(raw)
    const db = await loadUsers()
    const user = db.users[u]
    return user ? { username: u, user, db, token } : null
  } catch {
    return null
  }
}

// ---- per-user data (personal chats + usage) ----
const UDATA_PREFIX = 'ailysis:user:'

export async function loadUserData(username) {
  return (await getJSON(UDATA_PREFIX + username)) || { chats: [], usage: {} }
}

export async function saveUserData(username, data) {
  data.chats = (data.chats || []).slice(0, 20)
  const days = Object.keys(data.usage || {}).sort()
  for (const d of days.slice(0, -3)) delete data.usage[d]
  await setJSON(UDATA_PREFIX + username, data)
}

export function publicUser(username, user) {
  return { username, tier: user.tier || 'free', role: user.role || 'user', createdAt: user.createdAt }
}
