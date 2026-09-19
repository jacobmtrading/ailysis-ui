// The tradeable / searchable universe. t = ticker, n = name, ind = industry,
// type = stock | etf, cap = market cap in $B (null = unknown).
// Stocks come from the generated universe-data.js (npm run universe): every
// US-listed stock >= $1B incl. ADRs, plus major non-US companies trading as US
// OTC ADRs. ETFs stay hand-curated here because Emilia needs their top-5
// concentration. The client loads this module lazily (it's ~70KB).
import { INDUSTRIES, STOCK_ROWS } from './universe-data.js'

export { INDUSTRIES }

export const STOCKS = STOCK_ROWS.split('\n').map((row) => {
  const [t, n, ind, cap] = row.split('|')
  return { t, n, ind: INDUSTRIES[+ind], type: 'stock', cap: cap === '' ? null : +cap }
})

// top5 = approx % of fund in its 5 largest holdings, for Emilia's
// concentration check; >=30% is "too concentrated" in her book.
export const ETFS = [
  { t: 'VOO', n: 'Vanguard S&P 500', ind: 'Broad Market', type: 'etf', top5: 27 },
  { t: 'VTI', n: 'Vanguard Total Market', ind: 'Broad Market', type: 'etf', top5: 24 },
  { t: 'QQQ', n: 'Invesco Nasdaq 100', ind: 'Technology', type: 'etf', top5: 31 },
  { t: 'IWM', n: 'iShares Russell 2000', ind: 'Broad Market', type: 'etf', top5: 3 },
  { t: 'VEA', n: 'Vanguard Developed Markets', ind: 'International', type: 'etf', top5: 11 },
  { t: 'VWO', n: 'Vanguard Emerging Markets', ind: 'International', type: 'etf', top5: 18 },
  { t: 'VGK', n: 'Vanguard Europe', ind: 'International', type: 'etf', top5: 13 },
  { t: 'SCHD', n: 'Schwab US Dividend', ind: 'Dividend', type: 'etf', top5: 25 },
  { t: 'VIG', n: 'Vanguard Dividend Growth', ind: 'Dividend', type: 'etf', top5: 26 },
  { t: 'XLE', n: 'Energy Select SPDR', ind: 'Energy', type: 'etf', top5: 55 },
  { t: 'XLV', n: 'Health Care Select SPDR', ind: 'Healthcare', type: 'etf', top5: 42 },
  { t: 'XLF', n: 'Financial Select SPDR', ind: 'Financials', type: 'etf', top5: 36 },
  { t: 'ITA', n: 'iShares US Aerospace & Defense', ind: 'Aerospace & Defence', type: 'etf', top5: 55 },
  { t: 'SMH', n: 'VanEck Semiconductor', ind: 'Technology', type: 'etf', top5: 45 },
  { t: 'GLD', n: 'SPDR Gold Shares', ind: 'Commodities', type: 'etf', top5: 100 },
]

export const UNIVERSE = [...STOCKS, ...ETFS]
export const byTicker = Object.fromEntries(UNIVERSE.map((e) => [e.t, e]))

// Size for ranking; names without a known cap are the international blue chips.
const capRank = (e) => e.cap ?? (e.type === 'etf' ? 100 : 50)

// The fund's strategy scan: large names (>= $5B) plus broad ETFs for
// market-wide dips; VOO doubles as the "vs the market" benchmark. Largest
// first, so the daily baseline build covers the most important names first.
export const SCAN_MIN_CAP_B = 5
export const BENCHMARK = 'VOO'
export const SCAN_TICKERS = [
  BENCHMARK,
  'QQQ',
  ...STOCKS.filter((e) => capRank(e) >= SCAN_MIN_CAP_B)
    .sort((a, b) => capRank(b) - capRank(a))
    .map((e) => e.t),
]

// ETFs Emilia can reach for when the book drifts too stock-heavy.
export const CORE_ETFS = ['VOO', 'VTI', 'VEA', 'SCHD']

// ---------- Search (forgiving about case, accents and punctuation) ----------
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const normTicker = (s) => fold(s).replace(/[.\-\s]/g, '')
const normName = (s) => fold(s).replace(/['’.]/g, '').replace(/[-&/,]/g, ' ').replace(/\s+/g, ' ').trim()
const INDEX = UNIVERSE.map((e) => ({ e, t: normTicker(e.t), n: normName(e.n) }))

// "nestle" finds Nestlé, "brk.b" finds BRK-B. Best match first, then size.
export function searchUniverse(query, limit = 8) {
  const qt = normTicker(query)
  const qn = normName(query)
  if (!qn) return []
  const wordStart = new RegExp(`(^| )${qn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  const hits = []
  for (const x of INDEX) {
    const rank =
      x.t === qt ? 0
        : qt && x.t.startsWith(qt) ? 1
          : x.n.startsWith(qn) ? 2
            : wordStart.test(x.n) ? 3
              : x.n.includes(qn) ? 4
                : -1
    if (rank >= 0) hits.push([rank, capRank(x.e), x.e])
  }
  return hits
    .sort((a, b) => a[0] - b[0] || b[1] - a[1])
    .slice(0, limit)
    .map((h) => h[2])
}

// ---------- Shortlist for LLM prompts ----------
// The full list would cost ~40k tokens per call: send every curated ETF plus
// the largest names per industry (more in the client's preferred sectors).
export function llmUniverse({ sectors = [], exclude = [], perIndustry = 6, perPreferred = 20 } = {}) {
  const skip = new Set(exclude)
  const slim = (u) => ({ ticker: u.t, name: u.n, industry: u.ind, type: u.type })
  const out = ETFS.filter((e) => !skip.has(e.t)).map(slim)
  const taken = {}
  for (const e of [...STOCKS].sort((a, b) => capRank(b) - capRank(a))) {
    if (skip.has(e.t) || e.ind === 'Other') continue
    taken[e.ind] = (taken[e.ind] || 0) + 1
    if (taken[e.ind] <= (sectors.includes(e.ind) ? perPreferred : perIndustry)) out.push(slim(e))
  }
  return out
}

// ---------- Company names as headlines write them ----------
// Where that differs from `n` — used to check an event headline is really
// about this company.
const HEADLINE_NAMES = {
  AMD: ['AMD'],
  GOOGL: ['Google', 'Alphabet'],
  META: ['Meta'],
  ASML: ['ASML'],
  TSM: ['TSMC', 'Taiwan Semiconductor'],
  MU: ['Micron'],
  AMZN: ['Amazon'],
  MCD: ['McDonald'],
  JPM: ['JPMorgan'],
  BAC: ['Bank of America', 'BofA'],
  'BRK-B': ['Berkshire'],
  LLY: ['Eli Lilly', 'Lilly'],
  JNJ: ['Johnson & Johnson', 'J&J'],
  XOM: ['Exxon'],
  NEE: ['NextEra'],
  LMT: ['Lockheed'],
  RTX: ['RTX', 'Raytheon'],
  NOC: ['Northrop'],
  DE: ['Deere'],
  DIS: ['Disney'],
  PG: ['Procter & Gamble', 'P&G'],
}
const GENERIC_TAIL = /\s+(holdings?|group|technologies|technology|international|corporation|company|brands|industries|systems|enterprises|worldwide|platforms|incorporated)$/i
const TOO_GENERIC = new Set([
  'american', 'first', 'general', 'united', 'national', 'global', 'southern', 'northern', 'western', 'pacific',
  'royal', 'central', 'bank', 'capital', 'energy', 'health', 'digital', 'public', 'advanced', 'applied', 'regional', 'union',
])

// "The Cigna Group" -> ['The Cigna Group', 'Cigna']; "NVIDIA" -> ['NVIDIA', 'Nvidia']
export function headlineNames(e) {
  if (HEADLINE_NAMES[e.t]) return HEADLINE_NAMES[e.t]
  const names = [e.n]
  let short = e.n.replace(/^the\s+/i, '')
  for (let prev = ''; prev !== short; ) {
    prev = short
    short = short.replace(GENERIC_TAIL, '')
  }
  if (short !== e.n && short.length >= 3 && !TOO_GENERIC.has(short.toLowerCase())) names.push(short)
  for (const n of [...names]) if (/^[A-Z]{5,}$/.test(n)) names.push(n[0] + n.slice(1).toLowerCase())
  return names
}
