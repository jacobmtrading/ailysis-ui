// Personalized board features (auth required, tier-gated, daily-capped):
// POST /api/studio { action: 'analyze', ticker }              — premium+
// POST /api/studio { action: 'build', spec }                  — tailormade
// POST /api/studio { action: 'evaluate', positions }          — tailormade
// GET  /api/studio                                            — my past chats
import { sessionUser, loadUserData, saveUserData, TIER_RANK } from './_lib/auth.js'
import { runBoard, runBuild, runEvaluate } from './_lib/board.js'
import { assembleChat } from './_lib/portfolio.js'
import { fetchQuote, fetchStats, berlinDay } from './_lib/market.js'
import { newsHeadlines } from './_lib/scraper.js'
import { byTicker, UNIVERSE } from './_lib/universe.js'
import { json } from './_lib/http.js'

const DAILY_CAP = { premium: 5, tailormade: 15 }

export default async function handler(req, res) {
  try {
    const sess = await sessionUser(req)
    if (!sess) return json(res, 401, { error: 'log in first' })
    const tier = sess.user.tier || 'free'

    const udata = await loadUserData(sess.username)

    if (req.method === 'GET') {
      return json(res, 200, { chats: udata.chats, tier })
    }

    const { action } = req.body || {}
    const needTier = action === 'analyze' ? 'premium' : 'tailormade'
    if (TIER_RANK[tier] < TIER_RANK[needTier]) {
      return json(res, 403, { error: `This feature needs the ${needTier} subscription` })
    }

    const day = berlinDay()
    const used = udata.usage[day] || 0
    if (used >= (DAILY_CAP[tier] || 0)) {
      return json(res, 429, { error: `Daily limit reached (${DAILY_CAP[tier]} board sessions/day)` })
    }

    let chat = null

    if (action === 'analyze') {
      const ticker = String(req.body.ticker || '').toUpperCase()
      const entry = byTicker[ticker]
      if (!entry) return json(res, 400, { error: 'Unknown ticker (pick one from the list)' })
      const [quote, stats, headlines] = await Promise.all([
        fetchQuote(ticker),
        fetchStats(ticker),
        newsHeadlines(entry.n, ticker),
      ])
      const board = await runBoard({
        candidate: { ...entry, signals: [`Client request: personalized analysis of ${entry.n}`], headlines },
        stats,
        snapshot: {
          note: 'Advisory analysis for a client — judge the stock on its own merits, no fund book involved.',
          current_price: quote?.price,
        },
      })
      const yes = Object.values(board.votes).filter((v) => v === 'yes').length
      const verdict = board.decision.action === 'buy' ? `BUY (${yes}-${5 - yes})` : `PASS (${yes}-${5 - yes})`
      chat = assembleChat({
        id: `u-${sess.username}-${Date.now()}`,
        ticker,
        name: entry.n,
        source: 'Personalized analysis',
        board,
        question: `Would the board buy ${ticker}?`,
        decisionLine: `${board.closing || ''} Advisory verdict: ${verdict}. Not investment advice. 🎯`,
      })
      chat.positions = [{ ticker, weightPct: 100 }]
    }

    if (action === 'build') {
      const s = req.body.spec || {}
      const spec = {
        timeSpan: String(s.timeSpan || 'medium term').slice(0, 40),
        volatility: String(s.volatility || 'medium').slice(0, 20),
        maxPosPct: Math.max(5, Math.min(50, Number(s.maxPosPct) || 20)),
        sectors: (Array.isArray(s.sectors) ? s.sectors : []).slice(0, 8).map((x) => String(x).slice(0, 30)),
        themes: (Array.isArray(s.themes) ? s.themes : []).slice(0, 6).map((x) => String(x).slice(0, 30)),
        assetClass: String(s.assetClass || 'mixed').slice(0, 30),
      }
      const universe = UNIVERSE.map((u) => ({ ticker: u.t, name: u.n, industry: u.ind, type: u.type }))
      const board = await runBuild({ spec, universe })
      const lines = board.portfolio.map((p) => `• ${p.ticker} ${p.weightPct}% — ${p.reason}`).join('\n')
      const cashLeft = 100 - board.portfolio.reduce((x, p) => x + p.weightPct, 0)
      chat = assembleChat({
        id: `u-${sess.username}-${Date.now()}`,
        ticker: 'BUILD',
        name: 'Portfolio builder',
        source: `Spec: ${spec.timeSpan} · ${spec.volatility} volatility · max ${spec.maxPosPct}%/position`,
        board,
        question: 'Approve this portfolio?',
        decisionLine: `${board.closing || ''}\n\n📋 Proposed portfolio:\n${lines}${cashLeft > 0 ? `\n• Cash ${cashLeft}%` : ''}`,
      })
      chat.positions = board.portfolio.map((p) => ({ ticker: p.ticker, weightPct: p.weightPct }))
    }

    if (action === 'evaluate') {
      const rows = (Array.isArray(req.body.positions) ? req.body.positions : [])
        .slice(0, 15)
        .map((p) => ({
          ticker: String(p.ticker || '').toUpperCase().slice(0, 8),
          weightPct: Math.max(1, Math.min(100, Number(p.weightPct) || 0)),
        }))
        .filter((p) => p.ticker && p.weightPct)
      if (rows.length < 2) return json(res, 400, { error: 'Add at least 2 positions (ticker + weight)' })
      const board = await runEvaluate({ positions: rows })
      chat = assembleChat({
        id: `u-${sess.username}-${Date.now()}`,
        ticker: 'CHECK',
        name: 'Portfolio check',
        source: `Your portfolio: ${rows.map((r) => `${r.ticker} ${r.weightPct}%`).join(', ')}`.slice(0, 140),
        board,
        question: 'Would the board hold this portfolio as-is?',
        decisionLine: `${board.closing || ''} Board score: ${board.score}/10. 🏁`,
      })
      chat.positions = rows
    }

    if (!chat) return json(res, 400, { error: 'unknown action' })

    udata.usage[day] = used + 1
    udata.chats.unshift(chat)
    await saveUserData(sess.username, udata)
    return json(res, 200, { chat, remaining: (DAILY_CAP[tier] || 0) - used - 1 })
  } catch (err) {
    return json(res, 500, { error: String(err.message || err) })
  }
}
