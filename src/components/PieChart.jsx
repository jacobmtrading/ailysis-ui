// Hand-rolled SVG donut chart with a legend underneath.
function arc(cx, cy, r, startAngle, endAngle) {
  const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  const [x1, y1] = p(startAngle)
  const [x2, y2] = p(endAngle)
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

export default function PieChart({ title, sub, data, onClick }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const cx = 100
  const cy = 100
  const r = 74
  let a = -Math.PI / 2 // start at top
  const gap = 0.04

  const segs = data.map((d) => {
    const frac = d.value / total
    const start = a + gap / 2
    const end = a + frac * Math.PI * 2 - gap / 2
    a += frac * Math.PI * 2
    return { ...d, start, end }
  })

  return (
    <button type="button" className="pie-block" onClick={onClick}>
      <div className="pie-title">{title}</div>
      <svg viewBox="0 0 200 200" className="pie-svg">
        {segs.map((s, i) => (
          <path
            key={i}
            d={arc(cx, cy, r, s.start, s.end)}
            fill="none"
            stroke={s.color}
            strokeWidth="16"
            strokeLinecap="butt"
          />
        ))}
        <text x="100" y="96" textAnchor="middle" className="pie-center-top">
          {data.length}
        </text>
        <text x="100" y="116" textAnchor="middle" className="pie-center-sub">
          {sub || (data.length > 4 ? 'sectors' : 'classes')}
        </text>
      </svg>
      <div className="pie-legend">
        {data.map((d, i) => (
          <div className="pie-legend-row" key={i}>
            <span className="pie-dot" style={{ background: d.color }} />
            <span className="pie-legend-label">{d.label}</span>
            <span className="pie-legend-val">{d.value}%</span>
          </div>
        ))}
      </div>
      <div className="pie-cta">View positions ›</div>
    </button>
  )
}
