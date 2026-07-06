// Hand-rolled SVG line chart — Trade Republic light style:
// a single thin BLACK line on white, no fill, with a dotted baseline.
export default function LineChart({ data }) {
  const W = 1000
  const H = 460
  const padX = 4
  const padTop = 24
  const padBottom = 46

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const x = (i) => padX + (i / (data.length - 1)) * (W - padX * 2)
  const y = (v) => padTop + (1 - (v - min) / range) * (H - padTop - padBottom)

  const linePts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const baseY = H - 20

  return (
    <svg
      className="line-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={linePts}
        fill="none"
        stroke="#050505"
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
        stroke="#c8c8cc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0.5 9"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
