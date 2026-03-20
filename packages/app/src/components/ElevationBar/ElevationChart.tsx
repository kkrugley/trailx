interface ElevationChartProps {
  elevation: number[]
  width?: number
  height?: number
}

function downsample(arr: number[], maxPoints: number): number[] {
  if (arr.length <= maxPoints) return arr
  const stride = Math.ceil(arr.length / maxPoints)
  return arr.filter((_, i) => i % stride === 0)
}

export function ElevationChart({ elevation, width = 400, height = 80 }: ElevationChartProps) {
  const data = downsample(elevation, 200)
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const PAD_TOP = 8
  const PAD_BOTTOM = 4
  const drawH = height - PAD_TOP - PAD_BOTTOM

  const toY = (v: number) => PAD_TOP + drawH - ((v - min) / range) * drawH

  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * width).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(' ')

  const fillPts = `0,${height} ${pts} ${width},${height}`

  // Guide lines at 25%, 50%, 75% of the elevation range
  const guides = [0.25, 0.5, 0.75].map((frac) => ({
    y: toY(min + range * frac),
    label: `${Math.round(min + range * frac)} m`,
  }))

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: `${height}px`, display: 'block', overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4456b5" stopOpacity="0.22" />
          <stop offset="70%" stopColor="#879afd" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#879afd" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Guide lines */}
      {guides.map(({ y }) => (
        <line
          key={y}
          x1={0}
          y1={y.toFixed(1)}
          x2={width}
          y2={y.toFixed(1)}
          stroke="rgba(68, 86, 181, 0.12)"
          strokeWidth="1"
          strokeDasharray="3,4"
        />
      ))}

      {/* Filled area */}
      <polygon points={fillPts} fill="url(#elev-fill)" />

      {/* Profile line */}
      <polyline
        points={pts}
        fill="none"
        stroke="#4456b5"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Min/max tick labels */}
      <text x="2" y={toY(max) - 3} fontSize="8" fill="rgba(68,86,181,0.5)" fontFamily="Space Grotesk, sans-serif">
        {Math.round(max)} m
      </text>
      <text x="2" y={toY(min) + 10} fontSize="8" fill="rgba(68,86,181,0.5)" fontFamily="Space Grotesk, sans-serif">
        {Math.round(min)} m
      </text>
    </svg>
  )
}
