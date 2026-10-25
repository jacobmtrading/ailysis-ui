// "Export as PDF" for the portfolio builder's overview card. jsPDF is its own
// chunk, loaded only when someone actually exports.
export async function exportPortfolioPdf(overview) {
  const [{ jsPDF }, at] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  // The ESM build exports the function as default; the CJS build nests it one level deeper.
  const autoTable = typeof at.default === 'function' ? at.default : at.default.default
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const date = new Date(overview.createdAt || Date.now())
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // Header band.
  doc.setFillColor(11, 20, 26)
  doc.rect(0, 0, W, 78, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('ailysis', M, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(0, 168, 132)
  doc.text('Board-built portfolio', M, 58)
  doc.setTextColor(180, 190, 196)
  doc.text(dateStr, W - M, 40, { align: 'right' })
  if (overview.vote) doc.text(`Board vote ${overview.vote}`, W - M, 58, { align: 'right' })

  let y = 108
  const s = overview.spec || {}
  const specLine = [
    s.timeSpan,
    s.volatility && `${s.volatility} volatility`,
    s.maxPosPct && `max ${s.maxPosPct}% per position`,
    s.assetClass,
    s.sectors?.length && `sectors: ${s.sectors.join(', ')}`,
    s.themes?.length && `themes: ${s.themes.join(', ')}`,
  ]
    .filter(Boolean)
    .join(' · ')
  doc.setTextColor(110, 110, 115)
  doc.setFontSize(9)
  doc.text('YOUR SPEC', M, y)
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(10.5)
  const specLines = doc.splitTextToSize(specLine || '—', W - 2 * M)
  doc.text(specLines, M, y + 15)
  y += 15 + specLines.length * 13 + 14

  if (overview.summary) {
    doc.setTextColor(110, 110, 115)
    doc.setFontSize(9)
    doc.text("MODERATOR'S SUMMARY", M, y)
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(10.5)
    const sum = doc.splitTextToSize(overview.summary, W - 2 * M)
    doc.text(sum, M, y + 15)
    y += 15 + sum.length * 13 + 14
  }

  const rows = overview.positions.map((p) => [
    p.ticker,
    p.name,
    p.type === 'etf' ? `ETF · ${p.sector}` : p.sector,
    `${p.weightPct}%`,
    p.reason,
  ])
  if (overview.cashPct > 0) rows.push(['CASH', 'Cash reserve', '', `${overview.cashPct}%`, 'Unallocated'])

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Ticker', 'Name', 'Sector', 'Weight', 'Why it is in']],
    body: rows,
    foot: [
      ['', '', 'Total', `${overview.positions.reduce((a, p) => a + p.weightPct, 0) + (overview.cashPct || 0)}%`, ''],
    ],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 6, textColor: [30, 30, 30], valign: 'top' },
    headStyles: { fillColor: [11, 20, 26], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fontStyle: 'bold', textColor: [30, 30, 30], lineWidth: { top: 0.8 }, lineColor: [11, 20, 26] },
    alternateRowStyles: { fillColor: [244, 246, 247] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 52 },
      1: { cellWidth: 116 },
      2: { cellWidth: 100, textColor: [90, 90, 95] },
      3: { cellWidth: 50, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 'auto' },
    },
    didParseCell: ({ column, cell }) => {
      if (column.index === 3) cell.styles.halign = 'right'
    },
  })

  // Footer on every page.
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const H = doc.internal.pageSize.getHeight()
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 145)
    doc.text('Proposed by the ailysis agent board. Not investment advice.', M, H - 24)
    doc.text(`${i} / ${pages}`, W - M, H - 24, { align: 'right' })
  }

  doc.save(`ailysis-portfolio-${date.toISOString().slice(0, 10)}.pdf`)
}
