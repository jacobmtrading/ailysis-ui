// Stress-test scenario library, based on the current state of the world.
// Kept in code (like the universe) so the client can render the picker with
// zero API calls and the server can validate ids. cat = geopolitical |
// economic | energy | tech | society. tone = shock | relief.

export const SCENARIOS = [
  {
    id: 'taiwan-conflict',
    emoji: '🇹🇼',
    cat: 'geopolitical',
    tone: 'shock',
    title: 'China attacks Taiwan',
    desc: 'A military blockade or invasion of Taiwan halts TSMC exports, triggers Western sanctions on China and freezes cross-strait trade.',
  },
  {
    id: 'hormuz-closure',
    emoji: '🛢️',
    cat: 'energy',
    tone: 'shock',
    title: 'Strait of Hormuz stays closed',
    desc: 'The strait is blocked for months — a fifth of global oil and LNG transit stops, energy prices spike and shipping reroutes.',
  },
  {
    id: 'tariff-war',
    emoji: '📦',
    cat: 'geopolitical',
    tone: 'shock',
    title: 'Full US–China tariff escalation',
    desc: 'Both sides raise tariffs across the board, add export controls on chips and rare earths, and supply chains fracture into blocs.',
  },
  {
    id: 'rate-shock',
    emoji: '📈',
    cat: 'economic',
    tone: 'shock',
    title: 'Inflation returns, emergency rate hikes',
    desc: 'Inflation re-accelerates and central banks hike aggressively — discount rates jump, long-duration growth stocks reprice.',
  },
  {
    id: 'rate-cuts',
    emoji: '✂️',
    cat: 'economic',
    tone: 'relief',
    title: 'Faster-than-expected rate cut cycle',
    desc: 'Inflation cools quickly and central banks cut earlier and deeper than priced in — liquidity returns to risk assets.',
  },
  {
    id: 'ai-capex-bust',
    emoji: '🤖',
    cat: 'tech',
    tone: 'shock',
    title: 'AI capex freeze',
    desc: 'Hyperscalers slash AI datacenter spending after returns disappoint — the AI infrastructure supply chain sees orders vanish.',
  },
  {
    id: 'ai-regulation',
    emoji: '⚖️',
    cat: 'tech',
    tone: 'shock',
    title: 'Sweeping AI regulation in US & EU',
    desc: 'Strict liability, licensing and compute caps for frontier AI slow deployment and raise compliance costs for big tech.',
  },
  {
    id: 'eu-energy-crisis',
    emoji: '❄️',
    cat: 'energy',
    tone: 'shock',
    title: 'European energy crunch',
    desc: 'A cold winter plus supply disruptions send European gas and power prices soaring; industry curtails production.',
  },
  {
    id: 'cyber-finance',
    emoji: '🔓',
    cat: 'tech',
    tone: 'shock',
    title: 'Cyberattack on payment infrastructure',
    desc: 'A state-grade cyberattack disrupts card networks and bank settlement for days, shaking trust in digital payments.',
  },
  {
    id: 'pandemic-2',
    emoji: '🦠',
    cat: 'society',
    tone: 'shock',
    title: 'New pandemic with lockdowns',
    desc: 'A novel pathogen forces travel bans and partial lockdowns — services and travel collapse while stay-at-home demand returns.',
  },
  {
    id: 'mideast-detente',
    emoji: '🕊️',
    cat: 'geopolitical',
    tone: 'relief',
    title: 'Durable Middle East de-escalation',
    desc: 'A lasting regional agreement normalizes shipping and oil flows — energy risk premium unwinds and freight costs fall.',
  },
  {
    id: 'usd-slide',
    emoji: '💵',
    cat: 'economic',
    tone: 'shock',
    title: 'Sharp US dollar devaluation',
    desc: 'Deficit worries and reserve diversification trigger a fast dollar slide — exporters and commodities benefit, importers suffer.',
  },
]

export const scenarioById = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]))
