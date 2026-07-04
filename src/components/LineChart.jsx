// Hand-rolled responsive SVG area/line chart — Trade Republic style:
// a single thin line, whisper-quiet fill, no glow.
export default function LineChart({ data }) {
  const W = 1000
  const H = 560
  const padX = 4
  const padTop = 30
  const padBottom = 20

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const x = (i) => padX + (i / (data.length - 1)) * (W - padX * 2)
  const y = (v) => padTop + (1 - (v - min) / range) * (H - padTop - padBottom)

  const linePts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const areaPts = `${x(0)},${H} ${linePts} ${x(data.length - 1)},${H}`

  const lx = x(data.length - 1)
  const ly = y(data[data.length - 1])

  return (
    <svg
      className="line-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00c46e" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#00c46e" stopOpacity="0" />
        </linearGradient>
      </defs>

      <polygon points={areaPts} fill="url(#areaFill)" />
      <polyline
        points={linePts}
        fill="none"
        stroke="#00c46e"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lx} cy={ly} r="3.5" fill="#00c46e" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
