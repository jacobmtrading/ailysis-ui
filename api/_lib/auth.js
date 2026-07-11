// Users, sessions, codes — stored in Upstash Redis. Identity is email +
// password (scrypt-hashed). Sessions are random tokens with TTL. Email
// verification tokens are random and single-use with a 24h TTL.
import crypto from 'node:crypto'
import { getJSON, setJSON } from './redis.js'

const USERS_KEY = 'ailysis:users'
const SESS_PREFIX = 'ailysis:sess:'
const VERIFY_PREFIX = 'ailysis:verify:'
const LOGIN_PREFIX = 'ailysis:login:'
const RESET_PREFIX = 'ailysis:reset:'
const SESS_TTL_S = 30 * 86400 // 30 days
const VERIFY_TTL_S = 24 * 3600 // 24 hours
const LOGIN_TTL_S = 15 * 60 // 15 minutes
const RESET_TTL_S = 30 * 60 // 30 minutes

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

// Practical email check: something@something.tld, no spaces, sane length.
export function validEmail(e) {
  return typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

// Display name derived from an email when the user hasn't set their own.
export function nameFromEmail(email) {
  return String(email || '').split('@')[0] || 'you'
}

export function isAdmin(user) {
  return user?.role === 'admin'
}

export function adminEmail() {
  return (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
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

// ---- single-use email tokens (verify / magic-login / password-reset) ----
async function makeToken(prefix, email, ttl) {
  const token = crypto.randomBytes(24).toString('hex')
  await cmd('SET', prefix + token, String(email), 'EX', String(ttl))
  return token
}

// Returns the email the token was issued for (and deletes it), or null.
async function takeToken(prefix, token) {
  if (!token) return null
  const email = await cmd('GET', prefix + token)
  if (!email) return null
  await cmd('DEL', prefix + token)
  return email
}

export const createVerifyToken = (email) => makeToken(VERIFY_PREFIX, email, VERIFY_TTL_S)
export const consumeVerifyToken = (token) => takeToken(VERIFY_PREFIX, token)

export const createLoginToken = (email) => makeToken(LOGIN_PREFIX, email, LOGIN_TTL_S)
export const consumeLoginToken = (token) => takeToken(LOGIN_PREFIX, token)

export const createResetToken = (email) => makeToken(RESET_PREFIX, email, RESET_TTL_S)
export const consumeResetToken = (token) => takeToken(RESET_PREFIX, token)

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

export function publicUser(key, user) {
  const email = user.email || key
  return {
    email,
    name: user.name || nameFromEmail(email),
    tier: user.tier || 'free',
    role: user.role || 'user',
    emailVerified: !!user.emailVerified,
    createdAt: user.createdAt,
  }
}
