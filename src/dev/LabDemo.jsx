// Dev-only harness: open http://localhost:5173/?demo=lab to exercise the Lab
// (shared portfolio entry, tool grid, insight tools) with a fake logged-in user
// and the canned insights data. Builder runs return a canned board chat that
// opens in the chat overlay. Only reachable in `vite dev` — main.jsx guards it.
import { useState } from 'react'
import LabOverlay from '../components/LabOverlay'
import InsightsOverlay from '../components/InsightsOverlay'
import ChatOverlay from '../components/ChatOverlay'
import { useLab, addPosition, removePosition } from '../lab'
import '../dev/InsightsDemo.jsx' // installs the /api/insights fetch stub

const DEMO_USER = { username: 'demo', tier: 'tailormade' }

const BUILD_SPEC = { timeSpan: 'medium term (1-3y)', volatility: 'medium', maxPosPct: 20, sectors: ['Technology', 'Healthcare'], themes: ['Value'], assetClass: 'mixed (stocks + ETFs)' }
const BUILD_POSITIONS = [
  { ticker: 'VOO', weightPct: 20, name: 'Vanguard S&P 500', sector: 'Broad Market', type: 'etf', reason: 'Core anchor that keeps the ETF half broad and cheap.' },
  { ticker: 'VEA', weightPct: 15, name: 'Vanguard Developed Markets', sector: 'International', type: 'etf', reason: 'Adds non-US exposure so the book is not a pure US bet.' },
  { ticker: 'XLV', weightPct: 12, name: 'Health Care Select SPDR', sector: 'Healthcare', type: 'etf', reason: 'Defensive sector sleeve matching the healthcare preference.' },
  { ticker: 'MSFT', weightPct: 14, name: 'Microsoft', sector: 'Technology', type: 'stock', reason: 'Quality tech compounder with diversified cash flows.' },
  { ticker: 'GOOGL', weightPct: 12, name: 'Alphabet', sector: 'Communication', type: 'stock', reason: 'Trades at a discount to big-tech peers after the antitrust selloff.' },
  { ticker: 'JNJ', weightPct: 10, name: 'Johnson & Johnson', sector: 'Healthcare', type: 'stock', reason: 'Low-volatility healthcare ballast with a solid dividend.' },
  { ticker: 'ASML', weightPct: 9, name: 'ASML Holding', sector: 'Technology', type: 'stock', reason: 'Picks-and-shovels chip exposure, sized small for volatility.' },
]
const BUILD_CHAT = {
  id: 'demo-build',
  time: Date.now(),
  ticker: 'BUILD',
  name: 'Portfolio builder',
  source: 'Spec: medium term (1-3y) · medium volatility · max 20%/position',
  live: true,
  chat: [
    { from: 'emilia', text: 'Client wants mixed, so I want close to half in broad ETFs. VOO + VEA as the base 🧱', time: '10:01' },
    { from: 'valeria', text: 'For the tech sleeve: MSFT and GOOGL, both reasonable multiples for the cash they throw off.', time: '10:02' },
    { from: 'rayan', text: 'Cap is 20% per name and tech is already heavy — keep ASML small.', time: '10:03' },
    { from: 'kian', text: 'JNJ chart is a flat base, fits medium volatility fine.', time: '10:04' },
    { from: 'mod', text: 'Alright board — calling the vote. Approve this portfolio?', time: '10:05' },
    { from: 'mod', poll: true, question: 'Approve this portfolio?', time: '10:05', votes: [{ agent: 'max', vote: 'yes' }, { agent: 'valeria', vote: 'yes' }, { agent: 'kian', vote: 'yes' }, { agent: 'rayan', vote: 'yes' }, { agent: 'emilia', vote: 'no' }] },
    {
      from: 'mod',
      text: 'Balanced ETF core with a quality tech and healthcare sleeve.',
      time: '10:06',
      overview: {
        summary: 'A balanced build: 47% broad and sector ETFs as the core, topped with quality tech and defensive healthcare names, every position under the 20% cap.',
        vote: '4-1',
        spec: BUILD_SPEC,
        positions: BUILD_POSITIONS,
        cashPct: 8,
        createdAt: Date.now(),
      },
    },
  ],
}

// Intercept builder runs; everything else passes through to the insights stub.
const stubFetch = window.fetch.bind(window)
window.fetch = async (url, opts) => {
  if (String(url).includes('/api/studio')) {
    if (opts?.method === 'POST' && JSON.parse(opts.body).action === 'build') {
      await new Promise((r) => setTimeout(r, 800))
      return new Response(JSON.stringify({ chat: { ...BUILD_CHAT, messages: BUILD_CHAT.chat }, remaining: 14 }), { status: 200 })
    }
    return new Response(JSON.stringify({ chats: [] }), { status: 200 })
  }
  return stubFetch(url, opts)
}

export default function LabDemo() {
  const [ctx, setCtx] = useState(null)
  const [order, setOrder] = useState(null)
  const [lab, setLab] = useLab()
  return (
    <>
      <LabOverlay
        open
        user={DEMO_USER}
        lab={lab}
        onLab={setLab}
        onOpenChat={setOrder}
        onOpenInsights={setCtx}
        onUpgrade={() => {}}
        onClose={() => window.location.assign('/')}
      />
      <InsightsOverlay
        ctx={ctx}
        user={DEMO_USER}
        lab={lab}
        onAddToLab={(t) => setLab((l) => addPosition(l, t))}
        onRemoveFromLab={(t) => setLab((l) => removePosition(l, t))}
        onUpgrade={() => {}}
        onClose={() => setCtx(null)}
      />
      <ChatOverlay order={order} onClose={() => setOrder(null)} />
    </>
  )
}
