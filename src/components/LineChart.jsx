// Hand-rolled SVG line chart — Trade Republic light style:
// a single thin WHITE line on black, no fill, with a dotted baseline.
// compare: optional [{ key, color, data }] index lines drawn behind it,
// already scaled to the portfolio's starting value.
export default function LineChart({ data, compare = [] }) {
  const W = 1000
  const H = 460
  const padX = 4
  const padTop = 24
  const padBottom = 46

  const all = [data, ...compare.map((c) => c.data)].flat()
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1

  const x = (i, n) => padX + (i / (n - 1)) * (W - padX * 2)
  const y = (v) => padTop + (1 - (v - min) / range) * (H - padTop - padBottom)
  const points = (series) => series.map((v, i) => `${x(i, series.length)},${y(v)}`).join(' ')

  const baseY = H - 20

  return (
    <svg
      className="line-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {compare.map((c) => (
        <polyline
          key={c.key}
          points={points(c.data)}
          fill="none"
          stroke={c.color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <polyline
        points={points(data)}
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* dotted baseline */}
      <line
        x1={padX}
        y1={baseY}
        x2={W - padX}
        y2={baseY}
        stroke="#48484a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0.5 9"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
