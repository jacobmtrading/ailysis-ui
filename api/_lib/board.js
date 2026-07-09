// The agent board — ONE DeepSeek call generates the entire discussion + vote
// + decision as JSON. The system prompt is byte-stable so DeepSeek's automatic
// context caching kicks in on every call after the first (~10x cheaper input).

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

// NOTE: keep this string stable — do not interpolate anything into it.
const SYSTEM_PROMPT = `You are the investment board of "ailysis", an autonomous paper-trading fund. You simulate a lively WhatsApp group discussion between five agents with sharply different investment philosophies, then vote.

THE AGENTS (use these exact keys):
- "max" — Max Momentum. Analyses trends and current news around the company and its industry. ALWAYS ends his main message with a short future outlook listing 2-3 scenarios with rough probabilities (e.g. "60% base case: ..., 25% bull: ..., 15% bear: ...").
- "valeria" — Valeria Value. Deep value investor. Argues ONLY with numbers: valuation multiples, cash flow, margins, balance sheet. Skeptical of hype. If she has no solid numbers she says so and stays cautious.
- "kian" — Kian Quant. Pure chart/technical analyst. Argues from the price data provided (trend, momentum, distance from highs). No fundamentals.
- "rayan" — Rayan Risk. Portfolio strategist. Cares about position sizing, stop losses, and industry concentration. Uses the REAL portfolio weights provided. Objects if a buy would overweight one industry (>30% is too much).
- "emilia" — Emilia ETF. Guardian of asset allocation. Target: 50% ETFs / 50% single stocks. Uses the REAL split provided. If the book is drifting stock-heavy she pushes back on stock buys or demands a smaller size. She ALSO inspects ETF internal concentration: when the candidate is an ETF, "etf_top5_concentration_pct" is provided — she dislikes ETFs whose top-5 holdings are 30% or more of the fund (that's a concentrated sector bet, not real diversification) and argues against them or pushes for a broader alternative (e.g. VOO/VTI). Below 30% she's comfortable.
- "mod" — The Moderator. Neutral chair. Interrupts at the end, calls the vote, announces the result.

RULES:
- 7 to 10 messages total (before the vote), each 1-3 sentences, casual group-chat tone, occasional emoji. Agents react to each other and disagree when their philosophies clash.
- Ground every argument in the data provided (signals, headlines, chart stats, portfolio weights). Do not invent precise numbers you were not given; approximate ("trades around 30x earnings") is fine when widely known.
- Then ALL FIVE agents vote yes or no. Majority wins. The decision must be consistent with the vote and with Rayan/Emilia's constraints.
- sizePct: 1-5 (% of total portfolio value). stopPct: 8-18 (stop-loss distance).

Respond with ONLY this JSON:
{
  "messages": [{"from": "max", "text": "..."}, ...],
  "votes": {"max": "yes|no", "valeria": "yes|no", "kian": "yes|no", "rayan": "yes|no", "emilia": "yes|no"},
  "closing": "one short moderator line announcing the outcome and size/stop if buying",
  "decision": {"action": "buy|pass", "sizePct": 3, "stopPct": 12, "reason": "one sentence"}
}`

const REVIEW_PROMPT = `You are the investment board of "ailysis", an autonomous paper-trading fund, holding your daily portfolio review in the group chat. Same five agents and exact keys as always: "max" (momentum/news, always gives scenario outlooks with probabilities), "valeria" (value, argues only with numbers), "kian" (charts only), "rayan" (risk/weighting strategist), "emilia" (50/50 ETF-stock allocation guardian), "mod" (moderator).

You are given the current positions with live P/L and the portfolio balance. Decide if anything should be SOLD today (thesis broken, better use of capital, trim overweight industries, or restore the 50/50 ETF/stock balance). Selling nothing is a perfectly good outcome — do not churn.

RULES:
- 5 to 8 messages, 1-3 sentences each, casual tone, agents disagree when philosophies clash, grounded in the data given.
- Then all five vote on the moderator's proposal (which may be "hold everything").
- At most 2 sells. portionPct is how much of the position to sell (25-100).

Respond with ONLY this JSON:
{
  "messages": [{"from": "max", "text": "..."}, ...],
  "votes": {"max": "yes|no", "valeria": "yes|no", "kian": "yes|no", "rayan": "yes|no", "emilia": "yes|no"},
  "closing": "one short moderator line announcing the outcome",
  "proposal": "one short line describing what was voted on",
  "sells": [{"ticker": "XYZ", "portionPct": 100, "reason": "one sentence"}]
}`

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
      temperature: 0.7,
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

const AGENT_KEYS = ['max', 'valeria', 'kian', 'rayan', 'emilia']

function cleanMessages(messages, maxLen) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && AGENT_KEYS.includes(m.from) && typeof m.text === 'string' && m.text.trim())
    .slice(0, maxLen)
    .map((m) => ({ from: m.from, text: m.text.trim().slice(0, 400) }))
}

function cleanVotes(votes) {
  const out = {}
  for (const k of AGENT_KEYS) out[k] = votes?.[k] === 'no' ? 'no' : 'yes'
  return out
}

export async function runBoard({ candidate, stats, snapshot }) {
  const user = JSON.stringify({
    candidate: {
      ticker: candidate.t,
      name: candidate.n,
      industry: candidate.ind,
      type: candidate.type,
      signals: candidate.signals,
      recent_headlines: candidate.headlines,
      ...(candidate.type === 'etf' && candidate.top5 != null
        ? { etf_top5_concentration_pct: candidate.top5 }
        : {}),
    },
    chart_stats: stats,
    portfolio: snapshot,
  })
  const raw = await callDeepSeek(SYSTEM_PROMPT, user, 1500)
  const votes = cleanVotes(raw.votes)
  const yes = Object.values(votes).filter((v) => v === 'yes').length
  const decision = raw.decision || {}
  return {
    messages: cleanMessages(raw.messages, 10),
    votes,
    closing: String(raw.closing || '').slice(0, 300),
    decision: {
      action: yes >= 3 && decision.action === 'buy' ? 'buy' : 'pass',
      sizePct: Math.min(5, Math.max(1, Number(decision.sizePct) || 2)),
      stopPct: Math.min(18, Math.max(8, Number(decision.stopPct) || 12)),
      reason: String(decision.reason || '').slice(0, 200),
    },
  }
}

export async function runReview({ positions, snapshot }) {
  const user = JSON.stringify({ positions, portfolio: snapshot })
  const raw = await callDeepSeek(REVIEW_PROMPT, user, 1200)
  const held = new Set(positions.map((p) => p.ticker))
  const sells = (Array.isArray(raw.sells) ? raw.sells : [])
    .filter((s) => s && held.has(s.ticker))
    .slice(0, 2)
    .map((s) => ({
      ticker: s.ticker,
      portionPct: Math.min(100, Math.max(25, Number(s.portionPct) || 100)),
      reason: String(s.reason || '').slice(0, 200),
    }))
  return {
    messages: cleanMessages(raw.messages, 8),
    votes: cleanVotes(raw.votes),
    closing: String(raw.closing || '').slice(0, 300),
    proposal: String(raw.proposal || 'Daily portfolio review').slice(0, 200),
    sells,
  }
}
