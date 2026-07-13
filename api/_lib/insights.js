// Premium insight tools — risk map scoring, SWOT, scenario stress tests.
// Same pattern as board.js: ONE DeepSeek call per tool, byte-stable system
// prompts so context caching kicks in, and code-side clamping of the output.

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

async function callDeepSeek(system, user, maxTokens = 1500) {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error('DEEPSEEK_API_KEY is not set')
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

const clamp01 = (v, fallback = 50) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback
}

// ---------- Risk map: score each holding on three axes + propose additions ----------
// NOTE: keep this string stable — do not interpolate anything into it.
const MAP_PROMPT = `You are the research desk of "ailysis", a paper-trading fund. You score stocks and ETFs on three risk axes for a polar risk map, then propose additions that would balance the client's portfolio.

THE THREE AXES (each 0-100):
- "political": political/geopolitical dependency — how much the business depends on government policy, regulation, subsidies, export controls, or geopolitical stability (100 = extremely exposed, e.g. Taiwan chip supply chains or defence budgets; 0 = almost immune).
- "momentum": momentum/expectancy dependency — how much the price is carried by news flow, narratives and high embedded expectations rather than steady fundamentals (100 = pure story/momentum stock; 0 = boring cash-flow compounder ignored by headlines).
- "valuation": where it trades vs fair value (0 = deeply undervalued, 50 = fairly valued, 100 = heavily overvalued on common multiples).

RULES:
- Score every holding in "portfolio". Use widely known facts about each company/ETF; be decisive, avoid clustering everything at 50.
- Each holding gets a "note": ONE short sentence naming its dominant risk.
- Then pick 3 to 5 PROPOSALS from "allowed_universe" that are NOT already held and would genuinely improve the map: offset clusters, lower aggregate political/momentum exposure, or add undervalued ballast. Score proposals on the same axes. Each proposal gets a "reason": 1-2 sentences explaining why it improves THIS portfolio (reference the actual holdings or clusters).

Respond with ONLY this JSON:
{
  "stocks": [{"ticker": "XYZ", "political": 60, "momentum": 40, "valuation": 55, "note": "..."}],
  "proposals": [{"ticker": "ABC", "political": 20, "momentum": 25, "valuation": 40, "reason": "..."}]
}`

export async function runMap({ items, universe }) {
  const user = JSON.stringify({
    portfolio: items,
    allowed_universe: universe,
  })
  const raw = await callDeepSeek(MAP_PROMPT, user, 1800)
  const held = new Set(items.map((i) => i.ticker))
  const allowed = new Set(universe.map((u) => u.ticker))
  const scoreOf = (s) => ({
    political: clamp01(s.political),
    momentum: clamp01(s.momentum),
    valuation: clamp01(s.valuation),
  })
  const stocks = (Array.isArray(raw.stocks) ? raw.stocks : [])
    .filter((s) => s && held.has(s.ticker))
    .map((s) => ({ ticker: s.ticker, ...scoreOf(s), note: String(s.note || '').slice(0, 200) }))
  // Every holding must land on the map, even if the model skipped one.
  for (const it of items) {
    if (!stocks.some((s) => s.ticker === it.ticker)) {
      stocks.push({ ticker: it.ticker, political: 50, momentum: 50, valuation: 50, note: '' })
    }
  }
  const proposals = (Array.isArray(raw.proposals) ? raw.proposals : [])
    .filter((p) => p && allowed.has(p.ticker) && !held.has(p.ticker))
    .slice(0, 5)
    .map((p) => ({ ticker: p.ticker, ...scoreOf(p), reason: String(p.reason || '').slice(0, 300) }))
  return { stocks, proposals }
}

// ---------- SWOT for a stock, ETF, or whole portfolio ----------
// NOTE: keep this string stable — do not interpolate anything into it.
const SWOT_PROMPT = `You are the research desk of "ailysis", a paper-trading fund. Produce a sharp SWOT analysis of the subject the client provides — either a single stock/ETF or an entire portfolio (then analyze it AS a portfolio: composition, concentration, correlations, macro exposure).

RULES:
- 3 to 5 bullets per quadrant, each ONE punchy sentence (max ~20 words), specific to the subject — no generic filler like "strong brand" without saying why it matters.
- Strengths/weaknesses = internal & structural today. Opportunities/threats = external & forward-looking.
- Ground bullets in widely known facts; approximate figures are fine when widely known.

Respond with ONLY this JSON:
{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "opportunities": ["..."],
  "threats": ["..."]
}`

const cleanList = (v, max = 5, len = 180) =>
  (Array.isArray(v) ? v : [])
    .filter((x) => typeof x === 'string' && x.trim())
    .slice(0, max)
    .map((x) => x.trim().slice(0, len))

export async function runSwot({ subject }) {
  const raw = await callDeepSeek(SWOT_PROMPT, JSON.stringify({ subject }), 1200)
  return {
    strengths: cleanList(raw.strengths),
    weaknesses: cleanList(raw.weaknesses),
    opportunities: cleanList(raw.opportunities),
    threats: cleanList(raw.threats),
  }
}

// ---------- Stress test: swarm reaction, then per-position economics ----------
// NOTE: keep this string stable — do not interpolate anything into it.
const STRESS_PROMPT = `You are the scenario-simulation desk of "ailysis", a paper-trading fund. The client picked a hypothetical world event and wants their positions stress-tested in two steps.

STEP 1 — SWARM REACTION: simulate how different groups in the world would plausibly react in the first weeks, as a swarm-intelligence read. Cover exactly these four groups (use these exact names): "Nations & governments", "Major companies", "Consumers", "Society & markets". 2-3 sentences each, concrete and scenario-specific (name real countries, institutions or behaviors where sensible).

STEP 2 — PORTFOLIO ECONOMICS: for EVERY position provided, estimate the economic effect over ~6 months: "impactPct" (rough total-return effect, -80 to +80, integer) and "note" (one sentence on the mechanism — demand, supply chain, multiple compression, substitution, policy). Be differentiated: the same shock hits industries very differently, and some positions can WIN.

Then list overall "risks" (3-5 bullets) AND "opportunities" (2-4 bullets — every shock creates winners: hedges, substitutes, beneficiaries, entry points). Finish with "summary": 2 sentences on whether this portfolio is resilient to this scenario. This is a hypothetical simulation, not investment advice.

Respond with ONLY this JSON:
{
  "swarm": [{"group": "Nations & governments", "reaction": "..."}],
  "impacts": [{"ticker": "XYZ", "impactPct": -25, "note": "..."}],
  "risks": ["..."],
  "opportunities": ["..."],
  "summary": "..."
}`

const SWARM_GROUPS = ['Nations & governments', 'Major companies', 'Consumers', 'Society & markets']

export async function runStress({ scenario, items }) {
  const user = JSON.stringify({
    scenario: { title: scenario.title, description: scenario.desc },
    positions: items,
  })
  const raw = await callDeepSeek(STRESS_PROMPT, user, 2000)
  const byGroup = {}
  for (const s of Array.isArray(raw.swarm) ? raw.swarm : []) {
    if (s && SWARM_GROUPS.includes(s.group)) byGroup[s.group] = String(s.reaction || '').slice(0, 500)
  }
  const swarm = SWARM_GROUPS.filter((g) => byGroup[g]).map((g) => ({ group: g, reaction: byGroup[g] }))
  const held = new Set(items.map((i) => i.ticker))
  const impacts = (Array.isArray(raw.impacts) ? raw.impacts : [])
    .filter((x) => x && held.has(x.ticker))
    .map((x) => ({
      ticker: x.ticker,
      impactPct: Math.max(-80, Math.min(80, Math.round(Number(x.impactPct) || 0))),
      note: String(x.note || '').slice(0, 250),
    }))
  return {
    swarm,
    impacts,
    risks: cleanList(raw.risks, 5, 250),
    opportunities: cleanList(raw.opportunities, 4, 250),
    summary: String(raw.summary || '').slice(0, 500),
  }
}
