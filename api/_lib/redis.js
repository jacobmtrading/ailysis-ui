// Minimal Upstash Redis REST client — zero dependencies.
// Works with the env vars added automatically by the Vercel + Upstash
// marketplace integration (either naming scheme).
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

export function redisConfigured() {
  return Boolean(URL_ && TOKEN)
}

async function cmd(...args) {
  if (!redisConfigured()) throw new Error('Redis is not configured (add the Upstash integration in Vercel)')
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`Redis error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (data.error) throw new Error(`Redis: ${data.error}`)
  return data.result
}

export async function getJSON(key) {
  const raw = await cmd('GET', key)
  if (raw == null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function setJSON(key, value) {
  await cmd('SET', key, JSON.stringify(value))
}
