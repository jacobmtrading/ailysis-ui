// Dev-only harness: open http://localhost:5173/?demo=insights to play with the
// insights overlay using canned data (no login, no DeepSeek, no Redis).
// Only reachable in `vite dev` — main.jsx guards it with import.meta.env.DEV.
import InsightsOverlay from '../components/InsightsOverlay'

const MOCK_MAP = {
  stocks: [
    { ticker: 'NVDA', name: 'NVIDIA', industry: 'Technology', political: 85, momentum: 92, valuation: 80, note: 'Export controls and Taiwan supply chain make it the most politically exposed name here.' },
    { ticker: 'TSM', name: 'Taiwan Semiconductor', industry: 'Technology', political: 95, momentum: 60, valuation: 45, note: 'Ground zero for any cross-strait escalation.' },
    { ticker: 'MSFT', name: 'Microsoft', industry: 'Technology', political: 45, momentum: 55, valuation: 65, note: 'AI expectations are embedded but cash flows are diversified.' },
    { ticker: 'XOM', n: 'Exxon Mobil', name: 'Exxon Mobil', industry: 'Energy', political: 70, momentum: 30, valuation: 35, note: 'OPEC policy and sanctions drive the oil price it lives on.' },
    { ticker: 'KO', name: 'Coca-Cola', industry: 'Consumer', political: 15, momentum: 10, valuation: 55, note: 'Boring compounder — headlines barely move it.' },
    { ticker: 'LMT', name: 'Lockheed Martin', industry: 'Aerospace & Defence', political: 90, momentum: 40, valuation: 50, note: 'Revenue is literally government budgets.' },
  ],
  proposals: [
    { ticker: 'JNJ', name: 'Johnson & Johnson', industry: 'Healthcare', political: 30, momentum: 15, valuation: 40, reason: 'Adds a defensive, low-news healthcare anchor that offsets your tech cluster’s political and momentum exposure.' },
    { ticker: 'BRK-B', name: 'Berkshire Hathaway', industry: 'Financials', political: 20, momentum: 12, valuation: 48, reason: 'Diversified cash-flow ballast with almost no narrative dependency — pulls the portfolio centroid toward low risk.' },
    { ticker: 'NEE', name: 'NextEra Energy', industry: 'Energy', political: 55, momentum: 25, valuation: 38, reason: 'Regulated utility cash flows diversify your fossil energy exposure and look undervalued after the rate scare.' },
  ],
}

const MOCK_SWOT = {
  strengths: ['Heavy exposure to the strongest secular trend (AI compute)', 'High-quality balance sheets across all six names', 'Energy sleeve hedges inflation shocks'],
  weaknesses: ['62% of weight in one industry cluster (Technology)', 'Two positions depend on Taiwan supply chains', 'Almost no exposure to defensives or rate-sensitive value'],
  opportunities: ['Rate-cut cycle would re-rate the growth names further', 'Defence budgets rising across NATO benefits LMT', 'Adding healthcare/staples ballast is cheap right now'],
  threats: ['Cross-strait escalation hits NVDA and TSM simultaneously', 'AI capex digestion could compress tech multiples 20%+', 'Concentrated momentum unwinds fast in risk-off tapes'],
}

const MOCK_STRESS = {
  swarm: [
    { group: 'Nations & governments', reaction: 'The US, Japan and EU impose sweeping sanctions on China within days; export controls extend to all advanced chips. Emergency chip-supply task forces form in Washington and Brussels.' },
    { group: 'Major companies', reaction: 'Apple, NVIDIA and AMD activate contingency sourcing; hyperscalers hoard existing GPU inventory. Defence primes see order books surge.' },
    { group: 'Consumers', reaction: 'Electronics prices jump 20-40% as chip supply craters; consumers delay device upgrades and shift spend to essentials.' },
    { group: 'Society & markets', reaction: 'Global equities gap down 10-15%; VIX spikes above 50. Flight to defence, energy and gold; semis and Taiwan-linked names are hit hardest.' },
  ],
  impacts: [
    { ticker: 'NVDA', impactPct: -45, note: 'Loses TSMC leading-edge capacity — no near-term substitute for Blackwell-class production.' },
    { ticker: 'TSM', impactPct: -70, note: 'Direct existential exposure; fabs at risk and ADR liquidity dries up.' },
    { ticker: 'MSFT', impactPct: -18, note: 'Azure GPU expansion stalls, but diversified software cash flows cushion the blow.' },
    { ticker: 'XOM', impactPct: 15, note: 'Energy risk premium and rerouted trade lift crude prices.' },
    { ticker: 'KO', impactPct: -4, note: 'Classic defensive — earnings barely move, multiple holds.' },
    { ticker: 'LMT', impactPct: 30, note: 'Defence budgets surge across the Pacific and NATO; backlog visibility improves for years.' },
  ],
  risks: ['Two-position Taiwan concentration compounds the shock', 'Tech cluster amplifies the drawdown to roughly -35% portfolio-wide', 'Sanctions retaliation could hit any China-revenue name'],
  opportunities: ['Defence and energy sleeves act as natural hedges — consider sizing them up', 'US-fab semis (Intel, Micron) become strategic winners', 'Post-shock entry points in quality software at compressed multiples'],
  summary: 'This portfolio is NOT resilient to a Taiwan conflict: the tech cluster and double Taiwan exposure dominate. The energy and defence sleeves help, but ballast in healthcare, staples or US-fab names would materially cut the tail risk.',
}

// Intercept only the insights endpoint; everything else passes through.
const realFetch = window.fetch.bind(window)
window.fetch = async (url, opts) => {
  if (String(url).includes('/api/insights')) {
    const { action } = JSON.parse(opts.body)
    const out = action === 'map' ? MOCK_MAP : action === 'swot' ? MOCK_SWOT : MOCK_STRESS
    await new Promise((r) => setTimeout(r, 600))
    return new Response(JSON.stringify({ ...out, remaining: 29 }), { status: 200 })
  }
  return realFetch(url, opts)
}

const DEMO_CTX = {
  view: 'map',
  label: 'Demo portfolio',
  items: [
    { ticker: 'NVDA', weightPct: 25 },
    { ticker: 'TSM', weightPct: 15 },
    { ticker: 'MSFT', weightPct: 20 },
    { ticker: 'XOM', weightPct: 15 },
    { ticker: 'KO', weightPct: 10 },
    { ticker: 'LMT', weightPct: 15 },
  ],
}

export default function InsightsDemo() {
  return <InsightsOverlay ctx={DEMO_CTX} user={{ tier: 'tailormade' }} onUpgrade={() => {}} onClose={() => window.location.assign('/')} />
}
