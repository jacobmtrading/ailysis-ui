// The tradeable universe (US-listed, priced via Stooq). Keeping this in code
// lets the scraper resolve tickers/industries with zero LLM calls.
// t = ticker, n = name, ind = industry, type = stock | etf

export const UNIVERSE = [
  // ---- Stocks ----
  { t: 'AAPL', n: 'Apple', ind: 'Technology', type: 'stock' },
  { t: 'MSFT', n: 'Microsoft', ind: 'Technology', type: 'stock' },
  { t: 'NVDA', n: 'NVIDIA', ind: 'Technology', type: 'stock' },
  { t: 'AMD', n: 'Advanced Micro Devices', ind: 'Technology', type: 'stock' },
  { t: 'AVGO', n: 'Broadcom', ind: 'Technology', type: 'stock' },
  { t: 'GOOGL', n: 'Alphabet', ind: 'Technology', type: 'stock' },
  { t: 'META', n: 'Meta Platforms', ind: 'Technology', type: 'stock' },
  { t: 'CRM', n: 'Salesforce', ind: 'Technology', type: 'stock' },
  { t: 'ORCL', n: 'Oracle', ind: 'Technology', type: 'stock' },
  { t: 'PLTR', n: 'Palantir', ind: 'Technology', type: 'stock' },
  { t: 'ASML', n: 'ASML Holding', ind: 'Technology', type: 'stock' },
  { t: 'TSM', n: 'Taiwan Semiconductor', ind: 'Technology', type: 'stock' },
  { t: 'INTC', n: 'Intel', ind: 'Technology', type: 'stock' },
  { t: 'MU', n: 'Micron Technology', ind: 'Technology', type: 'stock' },
  { t: 'AMZN', n: 'Amazon.com', ind: 'Consumer', type: 'stock' },
  { t: 'TSLA', n: 'Tesla', ind: 'Consumer', type: 'stock' },
  { t: 'NKE', n: 'Nike', ind: 'Consumer', type: 'stock' },
  { t: 'SBUX', n: 'Starbucks', ind: 'Consumer', type: 'stock' },
  { t: 'MCD', n: "McDonald's", ind: 'Consumer', type: 'stock' },
  { t: 'COST', n: 'Costco', ind: 'Consumer', type: 'stock' },
  { t: 'WMT', n: 'Walmart', ind: 'Consumer', type: 'stock' },
  { t: 'PG', n: 'Procter & Gamble', ind: 'Consumer', type: 'stock' },
  { t: 'KO', n: 'Coca-Cola', ind: 'Consumer', type: 'stock' },
  { t: 'PEP', n: 'PepsiCo', ind: 'Consumer', type: 'stock' },
  { t: 'JPM', n: 'JPMorgan Chase', ind: 'Financials', type: 'stock' },
  { t: 'BAC', n: 'Bank of America', ind: 'Financials', type: 'stock' },
  { t: 'GS', n: 'Goldman Sachs', ind: 'Financials', type: 'stock' },
  { t: 'MS', n: 'Morgan Stanley', ind: 'Financials', type: 'stock' },
  { t: 'V', n: 'Visa', ind: 'Financials', type: 'stock' },
  { t: 'MA', n: 'Mastercard', ind: 'Financials', type: 'stock' },
  { t: 'BRK-B', n: 'Berkshire Hathaway', ind: 'Financials', type: 'stock' },
  { t: 'BLK', n: 'BlackRock', ind: 'Financials', type: 'stock' },
  { t: 'LLY', n: 'Eli Lilly', ind: 'Healthcare', type: 'stock' },
  { t: 'UNH', n: 'UnitedHealth', ind: 'Healthcare', type: 'stock' },
  { t: 'JNJ', n: 'Johnson & Johnson', ind: 'Healthcare', type: 'stock' },
  { t: 'PFE', n: 'Pfizer', ind: 'Healthcare', type: 'stock' },
  { t: 'MRK', n: 'Merck', ind: 'Healthcare', type: 'stock' },
  { t: 'ABBV', n: 'AbbVie', ind: 'Healthcare', type: 'stock' },
  { t: 'NVO', n: 'Novo Nordisk', ind: 'Healthcare', type: 'stock' },
  { t: 'XOM', n: 'Exxon Mobil', ind: 'Energy', type: 'stock' },
  { t: 'CVX', n: 'Chevron', ind: 'Energy', type: 'stock' },
  { t: 'COP', n: 'ConocoPhillips', ind: 'Energy', type: 'stock' },
  { t: 'NEE', n: 'NextEra Energy', ind: 'Energy', type: 'stock' },
  { t: 'BA', n: 'Boeing', ind: 'Aerospace & Defence', type: 'stock' },
  { t: 'LMT', n: 'Lockheed Martin', ind: 'Aerospace & Defence', type: 'stock' },
  { t: 'RTX', n: 'RTX Corp', ind: 'Aerospace & Defence', type: 'stock' },
  { t: 'NOC', n: 'Northrop Grumman', ind: 'Aerospace & Defence', type: 'stock' },
  { t: 'GE', n: 'GE Aerospace', ind: 'Aerospace & Defence', type: 'stock' },
  { t: 'KBR', n: 'KBR', ind: 'Aerospace & Defence', type: 'stock' },
  { t: 'CAT', n: 'Caterpillar', ind: 'Industrials', type: 'stock' },
  { t: 'DE', n: 'Deere & Co', ind: 'Industrials', type: 'stock' },
  { t: 'UPS', n: 'UPS', ind: 'Industrials', type: 'stock' },
  { t: 'UNP', n: 'Union Pacific', ind: 'Industrials', type: 'stock' },
  { t: 'DIS', n: 'Walt Disney', ind: 'Communication', type: 'stock' },
  { t: 'NFLX', n: 'Netflix', ind: 'Communication', type: 'stock' },
  { t: 'T', n: 'AT&T', ind: 'Communication', type: 'stock' },

  // ---- ETFs ----
  { t: 'VOO', n: 'Vanguard S&P 500', ind: 'Broad Market', type: 'etf' },
  { t: 'VTI', n: 'Vanguard Total Market', ind: 'Broad Market', type: 'etf' },
  { t: 'QQQ', n: 'Invesco Nasdaq 100', ind: 'Technology', type: 'etf' },
  { t: 'IWM', n: 'iShares Russell 2000', ind: 'Broad Market', type: 'etf' },
  { t: 'VEA', n: 'Vanguard Developed Markets', ind: 'International', type: 'etf' },
  { t: 'VWO', n: 'Vanguard Emerging Markets', ind: 'International', type: 'etf' },
  { t: 'VGK', n: 'Vanguard Europe', ind: 'International', type: 'etf' },
  { t: 'SCHD', n: 'Schwab US Dividend', ind: 'Dividend', type: 'etf' },
  { t: 'VIG', n: 'Vanguard Dividend Growth', ind: 'Dividend', type: 'etf' },
  { t: 'XLE', n: 'Energy Select SPDR', ind: 'Energy', type: 'etf' },
  { t: 'XLV', n: 'Health Care Select SPDR', ind: 'Healthcare', type: 'etf' },
  { t: 'XLF', n: 'Financial Select SPDR', ind: 'Financials', type: 'etf' },
  { t: 'ITA', n: 'iShares US Aerospace & Defense', ind: 'Aerospace & Defence', type: 'etf' },
  { t: 'SMH', n: 'VanEck Semiconductor', ind: 'Technology', type: 'etf' },
  { t: 'GLD', n: 'SPDR Gold Shares', ind: 'Commodities', type: 'etf' },
]

export const byTicker = Object.fromEntries(UNIVERSE.map((e) => [e.t, e]))

// Liquid subset scanned for big daily movers (kept small: 1 Stooq call each).
export const WATCHLIST = [
  'AAPL', 'MSFT', 'NVDA', 'AMD', 'AVGO', 'GOOGL', 'META', 'PLTR', 'ASML', 'TSM',
  'AMZN', 'TSLA', 'COST', 'WMT', 'JPM', 'GS', 'V', 'LLY', 'UNH', 'NVO',
  'XOM', 'CVX', 'BA', 'LMT', 'RTX', 'GE', 'CAT', 'DIS', 'NFLX', 'MU',
]

// ETFs Emilia can reach for when the book drifts too stock-heavy.
export const CORE_ETFS = ['VOO', 'VTI', 'VEA', 'SCHD']
