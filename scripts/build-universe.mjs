// Regenerates api/_lib/universe-data.js — the searchable / tradeable stock list.
//   npm run universe          (add --inspect for a data-quality report)
// Sources, free and keyless:
//   - Nasdaq's screener: every US-listed stock incl. ADRs, with sector,
//     industry and market cap (we keep >= $1B).
//   - A hand-picked list of major European/Asian companies that only trade
//     over the counter in the US, validated against CNBC (the app's price feed).
import { writeFileSync } from 'node:fs'

const MIN_CAP = 1e9
const INSPECT = process.argv.includes('--inspect')
const OUT = new URL('../api/_lib/universe-data.js', import.meta.url)
const UA = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json',
}

const INDUSTRIES = [
  'Technology', 'Communication', 'Consumer', 'Financials', 'Real Estate', 'Healthcare',
  'Energy', 'Utilities', 'Materials', 'Industrials', 'Aerospace & Defence', 'Other',
]

// Names the fund already knew, with the board's own classification and short names.
const CURATED = {
  AAPL: ['Apple', 'Technology'], MSFT: ['Microsoft', 'Technology'], NVDA: ['NVIDIA', 'Technology'],
  AMD: ['Advanced Micro Devices', 'Technology'], AVGO: ['Broadcom', 'Technology'], GOOGL: ['Alphabet', 'Technology'],
  META: ['Meta Platforms', 'Technology'], CRM: ['Salesforce', 'Technology'], ORCL: ['Oracle', 'Technology'],
  PLTR: ['Palantir', 'Technology'], ASML: ['ASML Holding', 'Technology'], TSM: ['Taiwan Semiconductor', 'Technology'],
  INTC: ['Intel', 'Technology'], MU: ['Micron Technology', 'Technology'], AMZN: ['Amazon.com', 'Consumer'],
  TSLA: ['Tesla', 'Consumer'], NKE: ['Nike', 'Consumer'], SBUX: ['Starbucks', 'Consumer'], MCD: ["McDonald's", 'Consumer'],
  COST: ['Costco', 'Consumer'], WMT: ['Walmart', 'Consumer'], PG: ['Procter & Gamble', 'Consumer'], KO: ['Coca-Cola', 'Consumer'],
  PEP: ['PepsiCo', 'Consumer'], JPM: ['JPMorgan Chase', 'Financials'], BAC: ['Bank of America', 'Financials'],
  GS: ['Goldman Sachs', 'Financials'], MS: ['Morgan Stanley', 'Financials'], V: ['Visa', 'Financials'],
  MA: ['Mastercard', 'Financials'], 'BRK-B': ['Berkshire Hathaway', 'Financials'], BLK: ['BlackRock', 'Financials'],
  LLY: ['Eli Lilly', 'Healthcare'], UNH: ['UnitedHealth', 'Healthcare'], JNJ: ['Johnson & Johnson', 'Healthcare'],
  PFE: ['Pfizer', 'Healthcare'], MRK: ['Merck', 'Healthcare'], ABBV: ['AbbVie', 'Healthcare'], NVO: ['Novo Nordisk', 'Healthcare'],
  XOM: ['Exxon Mobil', 'Energy'], CVX: ['Chevron', 'Energy'], COP: ['ConocoPhillips', 'Energy'], NEE: ['NextEra Energy', 'Utilities'],
  BA: ['Boeing', 'Aerospace & Defence'], LMT: ['Lockheed Martin', 'Aerospace & Defence'], RTX: ['RTX Corp', 'Aerospace & Defence'],
  NOC: ['Northrop Grumman', 'Aerospace & Defence'], GE: ['GE Aerospace', 'Aerospace & Defence'], KBR: ['KBR', 'Aerospace & Defence'],
  CAT: ['Caterpillar', 'Industrials'], DE: ['Deere & Co', 'Industrials'], UPS: ['UPS', 'Industrials'], UNP: ['Union Pacific', 'Industrials'],
  DIS: ['Walt Disney', 'Communication'], NFLX: ['Netflix', 'Communication'], T: ['AT&T', 'Communication'],
}

// Major non-US companies without a NYSE/Nasdaq listing (US OTC ADRs, priced in USD).
const INTERNATIONAL = [
  ['SIEGY', 'Siemens', 'Industrials'], ['ALIZY', 'Allianz', 'Financials'], ['RNMBY', 'Rheinmetall', 'Aerospace & Defence'],
  ['BASFY', 'BASF', 'Materials'], ['MBGYY', 'Mercedes-Benz Group', 'Consumer'], ['BMWKY', 'BMW', 'Consumer'],
  ['DTEGY', 'Deutsche Telekom', 'Communication'], ['ADDYY', 'Adidas', 'Consumer'], ['IFNNY', 'Infineon Technologies', 'Technology'],
  ['VWAGY', 'Volkswagen', 'Consumer'], ['MURGY', 'Munich Re', 'Financials'], ['DHLGY', 'DHL Group', 'Industrials'],
  ['BAYRY', 'Bayer', 'Healthcare'], ['EONGY', 'E.ON', 'Utilities'], ['RWEOY', 'RWE', 'Utilities'],
  ['EADSY', 'Airbus', 'Aerospace & Defence'], ['POAHY', 'Porsche Automobil Holding', 'Consumer'], ['HENKY', 'Henkel', 'Consumer'],
  ['MKKGY', 'Merck KGaA', 'Healthcare'], ['DBOEY', 'Deutsche Börse', 'Financials'], ['CRZBY', 'Commerzbank', 'Financials'],
  ['ZLNDY', 'Zalando', 'Consumer'], ['BDRFY', 'Beiersdorf', 'Consumer'], ['MTUAY', 'MTU Aero Engines', 'Aerospace & Defence'],
  ['VONOY', 'Vonovia', 'Real Estate'], ['HVRRY', 'Hannover Re', 'Financials'], ['SYIEY', 'Symrise', 'Materials'],
  ['CTTAY', 'Continental', 'Consumer'], ['SMMNY', 'Siemens Healthineers', 'Healthcare'], ['SMEGF', 'Siemens Energy', 'Industrials'],
  ['HAGHY', 'Hensoldt', 'Aerospace & Defence'], ['HLBZF', 'Heidelberg Materials', 'Materials'],
  ['LVMUY', 'LVMH', 'Consumer'], ['NSRGY', 'Nestlé', 'Consumer'], ['RHHBY', 'Roche', 'Healthcare'], ['LRLCY', "L'Oréal", 'Consumer'],
  ['HESAY', 'Hermès', 'Consumer'], ['SBGSY', 'Schneider Electric', 'Industrials'], ['SAFRY', 'Safran', 'Aerospace & Defence'],
  ['IDEXY', 'Inditex', 'Consumer'], ['ABBNY', 'ABB', 'Industrials'], ['CFRUY', 'Richemont', 'Consumer'],
  ['ESLOY', 'EssilorLuxottica', 'Healthcare'], ['DANOY', 'Danone', 'Consumer'], ['AXAHY', 'AXA', 'Financials'],
  ['BNPQY', 'BNP Paribas', 'Financials'], ['ENLAY', 'Enel', 'Utilities'], ['IBDRY', 'Iberdrola', 'Utilities'],
  ['VLVLY', 'Volvo', 'Industrials'], ['ATLKY', 'Atlas Copco', 'Industrials'], ['RNLSY', 'Renault', 'Consumer'],
  ['NTDOY', 'Nintendo', 'Communication'], ['SFTBY', 'SoftBank Group', 'Communication'], ['HTHIY', 'Hitachi', 'Industrials'],
  ['TOELY', 'Tokyo Electron', 'Technology'], ['TCEHY', 'Tencent', 'Communication'], ['XIACY', 'Xiaomi', 'Technology'],
  ['BYDDY', 'BYD', 'Consumer'],
]

// "Alibaba Group Holding Limited American Depositary Shares each representing…" -> "Alibaba Group Holding"
const CORP = String.raw`inc\.?|incorporated|corporation|corp\.?|plc\.?|ltd\.?|limited|n\.v\.|s\.a\.b\. de c\.v\.|s\.a\.`
function cleanName(raw) {
  let n = String(raw)
    .replace(/\)(?=\S)/g, ') ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\(?\b(each )?representing\b.*$/i, '')
    .replace(/^joint stock company\s+/i, '')
    .trim()
  // A corporate suffix followed by share-class junk: "FormFactor Inc. FormFactor", "Toyota Motor Corporation Common Stock".
  n = n.replace(new RegExp(String.raw`,?\s+(${CORP})\s+\S.*$`, 'i'), '')
  const tails = [
    /\s+(common stock|ordinary shares?|common shares?|capital stock|pfd\b.*|class [a-z]\b.*|cl [a-z]|series [a-z]\b.*|american deposit[ao]ry (shares?|receipts?)\b.*|(un)?spons[oe]?red\b.*|spon?osred\b.*|ads|adr\b.*|deposit[ao]ry (shares?|receipts?)|registered shares?|(new york|ny) registry( shares?)?|(subordinate )?voting shares.*|(no|\$?[\d.]+) par value|shares|new|reit|of beneficial interests?|beneficial interests?|[a-z])$/i,
    new RegExp(String.raw`,?\s+(${CORP}|company|co\.?|s\.?a\.?|n\.?v\.?|se|ag|l\.p\.|lp|llc)$`, 'i'),
    /\s*\([^)]*\)$/,
    /^the\s+/i,
  ]
  for (let prev = ''; prev !== n; ) {
    prev = n
    for (const re of tails) n = n.replace(re, '').trim()
  }
  return n || String(raw).trim()
}

function mapIndustry(sector, industry, name) {
  const i = industry || ''
  if (/aerospace|military\/government\/technical/i.test(i) || /\b(aerospace|defen[cs]e)\b/i.test(name)) return 'Aerospace & Defence'
  if (/retail|auto manufacturing|motor vehicles|auto parts|consumer services/i.test(i)) return 'Consumer'
  if (/environmental services/i.test(i)) return 'Industrials'
  if (/real estate/i.test(i) || sector === 'Real Estate') return 'Real Estate'
  if (/biotech|pharmaceutic|medical|dental|hospital|health|ophthalmic/i.test(i) || sector === 'Health Care') return 'Healthcare'
  if (/electric utilities|water supply|natural gas distribution|power generation/i.test(i)) return 'Utilities'
  if (/oil|gas production|petroleum|coal/i.test(i)) return 'Energy'
  // Nasdaq files carriers (Verizon, T-Mobile) as "Telecommunications Equipment" under the
  // Telecommunications sector; the same label elsewhere (Corning, Ciena) is real equipment.
  if (/telecommunications equipment/i.test(i)) return sector === 'Telecommunications' ? 'Communication' : 'Technology'
  if (/communications equipment|semiconductor|computer/i.test(i)) return 'Technology'
  if (/broadcasting|cable|advertising|movies|entertainment|publishing|newspapers/i.test(i) || sector === 'Telecommunications') return 'Communication'
  if (/chemical|steel|iron ore|mining|gold|precious metals|aluminum|copper|paper|containers|packaging|forest|building materials/i.test(i)) return 'Materials'
  switch (sector) {
    case 'Technology': return 'Technology'
    case 'Consumer Discretionary':
    case 'Consumer Staples': return 'Consumer'
    case 'Finance': return 'Financials'
    case 'Energy': return 'Energy'
    case 'Utilities': return 'Utilities'
    case 'Basic Materials': return 'Materials'
    case 'Industrials': return 'Industrials'
    default: return 'Other'
  }
}

const capOf = (s) => {
  const m = String(s || '').match(/^([\d.]+)([KMBT])?$/i)
  return m ? +m[1] * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(m[2] || '').toUpperCase()] || 1) : null
}

// ---- 1. Nasdaq screener
const res = await fetch('https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=25000&download=true', { headers: UA })
if (!res.ok) throw new Error(`Nasdaq screener ${res.status}`)
const rows = (await res.json())?.data?.rows || []
if (rows.length < 3000) throw new Error(`Nasdaq screener returned only ${rows.length} rows — refusing to shrink the universe`)

const excluded = {}
const skip = (why, r) => {
  excluded[why] = excluded[why] || []
  excluded[why].push(`${r.symbol} ${r.name}`)
}
const byName = new Map()
for (const r of rows) {
  const cap = Number(r.marketCap) || 0
  if (!/^[A-Z]{1,5}(\/[A-Z])?$/.test(r.symbol)) continue // preferreds (^), warrants, units
  if (cap < MIN_CAP) continue
  if (/\b(preferred|warrants?|units?|rights|notes|debentures|bonds?|strats|due (19|20)\d\d|depositary shares,? each representing a)\b/i.test(r.name)) { skip('security type', r); continue }
  if (r.industry === 'Blank Checks' || /acquisition corp/i.test(r.name)) { skip('SPAC', r); continue }
  if (/\bfund\b|\bmunicipal\b|\bincome (trust|fund)\b|\bETF\b/i.test(r.name)) { skip('fund', r); continue }

  const t = r.symbol.replace('/', '-')
  const curated = CURATED[t]
  const name = curated ? curated[0] : cleanName(r.name)
  const entry = {
    t,
    n: name,
    ind: curated ? curated[1] : mapIndustry(r.sector, r.industry, name),
    cap: Math.round(cap / 1e9),
    price: parseFloat(String(r.lastsale).replace(/[$,]/g, '')) || 0,
    raw: r,
  }
  // One line per company: share classes (GOOG/GOOGL, BRK-A/BRK-B) collapse to
  // the curated ticker, else the cheaper (more widely held) class.
  const key = entry.n.toLowerCase()
  const prev = byName.get(key)
  if (!prev || (curated && !CURATED[prev.t]) || (!CURATED[prev.t] && entry.price && entry.price < prev.price)) {
    if (prev) skip('duplicate share class', prev.raw)
    byName.set(key, entry)
  } else {
    skip('duplicate share class', r)
  }
}
const missingCurated = Object.keys(CURATED).filter((t) => ![...byName.values()].some((e) => e.t === t))
if (missingCurated.length) throw new Error(`curated tickers missing from screener: ${missingCurated.join(', ')}`)

// ---- 2. International OTC names, validated against CNBC quotes
const intl = []
const known = new Set([...byName.values()].map((e) => e.t))
for (let i = 0; i < INTERNATIONAL.length; i += 40) {
  const chunk = INTERNATIONAL.slice(i, i + 40)
  const url = `https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(chunk.map((c) => c[0]).join('|'))}&requestMethod=extended&noform=1&partnerId=2&output=json`
  const data = await (await fetch(url, { headers: UA })).json()
  let quotes = data?.FormattedQuoteResult?.FormattedQuote || []
  if (!Array.isArray(quotes)) quotes = [quotes]
  const ok = new Map(quotes.filter((q) => String(q.code) === '0' && parseFloat(q.last) > 0).map((q) => [q.symbol, q]))
  for (const [t, n, ind] of chunk) {
    if (known.has(t)) continue
    const q = ok.get(t)
    if (!q) { skip('international: no CNBC quote', { symbol: t, name: n }); continue }
    const cap = capOf(q.mktcapView)
    intl.push({ t, n, ind, cap: cap ? Math.round(cap / 1e9) : null })
  }
}

// ---- 3. Write
const all = [...byName.values(), ...intl].sort((a, b) => (b.cap ?? 50) - (a.cap ?? 50) || a.t.localeCompare(b.t))
const blob = all.map((e) => [e.t, e.n.replace(/[|\n]/g, ' '), INDUSTRIES.indexOf(e.ind), e.cap ?? ''].join('|')).join('\n')
const day = new Date().toISOString().slice(0, 10)
writeFileSync(
  OUT,
  `// GENERATED by scripts/build-universe.mjs on ${day} — do not edit by hand (npm run universe).
// ${all.length} stocks: US-listed incl. ADRs with market cap >= $1B (Nasdaq screener) plus
// major non-US companies trading as US OTC ADRs. Row: ticker|name|industry index|market cap $B (blank = unknown)
export const INDUSTRIES = ${JSON.stringify(INDUSTRIES)}
export const STOCK_ROWS = ${JSON.stringify(blob)}
`
)

const count = (list) => Object.entries(list.reduce((m, e) => ((m[e.ind] = (m[e.ind] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1])
console.log(`wrote ${all.length} stocks (${byName.size} US-listed, ${intl.length} international) — ${blob.length} bytes`)
console.log('by industry:', count(all).map(([k, v]) => `${k} ${v}`).join(', '))
console.log('>= $5B:', all.filter((e) => (e.cap ?? 50) >= 5).length)
for (const [why, list] of Object.entries(excluded)) console.log(`excluded (${why}): ${list.length}${INSPECT ? `\n  ${list.slice(0, 8).join('\n  ')}` : ''}`)
if (INSPECT) {
  const odd = all.filter((e) => /\b(inc|corp|ltd|plc|stock|shares|class|depositary|sponsored|series|registry|reit|beneficial)\b/i.test(e.n))
  console.log(`names that may need cleaning (${odd.length}):\n  ${odd.slice(0, 25).map((e) => `${e.t} ${e.n}`).join('\n  ')}`)
  for (const ind of ['Other', 'Communication', 'Materials', 'Aerospace & Defence', 'Consumer', 'Technology']) {
    console.log(`${ind} top:`, all.filter((e) => e.ind === ind).slice(0, 18).map((e) => `${e.t} ${e.n}`).join(' · '))
  }
  const probe = ['MFG', 'EQIX', 'IRM', 'FORM', 'WBD', 'KHC', 'AMX', 'OSK', 'NE', 'GFL', 'EDU', 'HSBC', 'TM', 'BABA', 'SHEL', 'SAP', 'HD', 'LOW', 'PH', 'HWM', 'CSCO', 'ANET']
  console.log('probe:', probe.map((t) => all.find((e) => e.t === t)).filter(Boolean).map((e) => `${e.t}=${e.n} (${e.ind})`).join(' · '))
}
