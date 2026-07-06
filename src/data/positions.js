// Current portfolio positions — Trade Republic-style holdings list.
// Shown when the user taps a cake/donut graph, and the biggest few are
// surfaced on the allocation page. `weight` = % of portfolio (fake).
// `badge` picks one of the colored logo tiles (badge-0 .. badge-5).
export const POSITIONS = [
  { name: 'Microsoft', ticker: 'MSFT', change: 6.5, weight: 11.2, badge: 3 },
  { name: 'NVIDIA', ticker: 'NVDA', change: 3.41, weight: 10.3, badge: 5 },
  { name: 'MSCI World Ex-USA USD (Acc)', ticker: 'ETF', change: 1.83, weight: 9.6, badge: 2 },
  { name: 'Amazon.com', ticker: 'AMZN', change: 2.98, weight: 8.4, badge: 1 },
  { name: 'ASML Holding', ticker: 'ASML', change: -0.72, weight: 7.6, badge: 1 },
  { name: 'MSCI World Equal Weight (USD)', ticker: 'ETF', change: 1.32, weight: 7.3, badge: 2 },
  { name: 'Global Aerospace & Defence', ticker: 'ETF', change: 5.82, weight: 6.9, badge: 3 },
  { name: 'KBR', ticker: 'KBR', change: 11.08, weight: 6.4, badge: 4 },
  { name: 'Future of Defence USD (Acc)', ticker: 'ETF', change: 9.17, weight: 5.8, badge: 0 },
  { name: 'Quality Equity Dividends ESG', ticker: 'ETF', change: 1.29, weight: 5.1, badge: 5 },
  { name: 'Space Innovators USD (Acc)', ticker: 'ETF', change: 17.46, weight: 4.7, badge: 5 },
  { name: 'MSCI Global SDG 7 Affordable', ticker: 'ETF', change: -0.16, weight: 3.2, badge: 2 },
]
