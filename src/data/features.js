// Everything a logged-in user can open, in menu order. The landing carousel
// and the account menu both render from this list. `tier` is the minimum tier
// that can run it (null = any account).
export const FEATURES = [
  {
    id: 'portfolio',
    name: 'AI Portfolio',
    tier: null,
    blurb: 'Watch the Ailysis fund trade on its own — live performance, every order with the board debate behind it, and the full allocation.',
  },
  {
    id: 'analyze',
    name: 'Personalized analysis',
    tier: 'premium',
    blurb: 'Pick any stock or ETF and the agent board debates it for you, then hands you a verdict.',
  },
  {
    id: 'build',
    name: 'Portfolio builder',
    tier: 'tailormade',
    blurb: 'Set your time span, risk, sectors and themes — the board assembles a portfolio that fits.',
  },
  {
    id: 'check',
    name: 'Check my portfolio',
    tier: 'tailormade',
    blurb: 'Enter your own holdings and get strengths, risks and a 1–10 score from the board.',
  },
  {
    id: 'map',
    name: 'Risk map',
    tier: 'premium',
    blurb: 'Political dependency, momentum and valuation on one polar map — plus stocks that fill the gaps.',
  },
  {
    id: 'swot',
    name: 'SWOT',
    tier: 'premium',
    blurb: 'Strengths, weaknesses, opportunities and threats for a stock or your whole book.',
  },
  {
    id: 'stress',
    name: 'Stress test',
    tier: 'premium',
    blurb: 'Pick a scenario — a Taiwan conflict, a closed Strait of Hormuz, a tariff war — and see how each position holds up.',
  },
]

export const TIER_RANK = { free: 0, premium: 1, tailormade: 2 }
export const TIER_LABEL = { free: 'Free', premium: 'Premium', tailormade: 'Tailormade' }

export const isLocked = (feature, user) =>
  !!feature.tier && TIER_RANK[user?.tier || 'free'] < TIER_RANK[feature.tier]
