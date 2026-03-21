import { useRef, useState, useCallback, useEffect } from 'react'

interface ElevationChartProps {
  elevation: number[]
  distance?: number   // total route distance in metres
  height?: number
}

interface HoverState {
  x: number           // svg-space x
  svgWidth: number    // rendered svg width in px
  index: number       // index in downsampled data
}

function downsample(arr: number[], maxPoints: number): number[] {
  if (arr.length <= maxPoints) return arr
  const stride = Math.ceil(arr.length / maxPoints)
  return arr.filter((_, i) => i % stride === 0)
}

const PAD_LEFT = 32

export function ElevationChart({ elevation, distance, height = 100 }: ElevationChartProps) {
  const data = downsample(elevation, 200)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [svgW, setSvgW] = useState(500)
  const [hover, setHover] = useState<HoverState | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setSvgW(Math.max(100, entry.contentRect.width))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const PAD_TOP = 10
  const PAD_BOTTOM = 18   // room for distance labels
  const drawH = height - PAD_TOP - PAD_BOTTOM
  const drawW = svgW - PAD_LEFT

  const toY = (v: number) => PAD_TOP + drawH - ((v - min) / range) * drawH
  const toX = (i: number) => PAD_LEFT + (i / (data.length - 1)) * drawW

  const pts = data.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const fillPts = `${PAD_LEFT},${height - PAD_BOTTOM} ${pts} ${svgW},${height - PAD_BOTTOM}`

  // Y-axis guides at 0%, 50%, 100%
  const guides = [0, 0.5, 1].map((frac) => ({
    y: toY(min + range * frac),
    label: `${Math.round(min + range * frac)}`,
  }))

  // Distance labels on X axis
  const distLabels = distance
    ? [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
        x: PAD_LEFT + frac * drawW,
        label: distFmt(distance * frac),
      }))
    : []

  const hoverPoint = hover != null ? data[hover.index] : null
  const hoverX = hover != null ? toX(hover.index) : 0
  const hoverY = hover != null ? toY(data[hover.index]) : 0
  const hoverDist = hover != null && distance
    ? (hover.index / (data.length - 1)) * distance
    : null

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const relX = e.clientX - rect.left
    // SVG coords now match pixel coords (viewBox = actual width)
    const svgX = Math.max(PAD_LEFT, Math.min(svgW, relX))
    const fraction = Math.max(0, Math.min(1, (svgX - PAD_LEFT) / drawW))
    const index = Math.round(fraction * (data.length - 1))
    setHover({ x: svgX, svgWidth: rect.width, index })
  }, [data.length, drawW, svgW])

  const handleMouseLeave = useCallback(() => setHover(null), [])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgW} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: `${height}px`, display: 'block', overflow: 'visible', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        aria-hidden
      >
        <defs>
          <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4456b5" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#879afd" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis guides */}
        {guides.map(({ y, label }) => (
          <g key={label}>
            <line
              x1={PAD_LEFT} y1={y.toFixed(1)}
              x2={svgW}   y2={y.toFixed(1)}
              stroke="rgba(68,86,181,0.1)" strokeWidth="1" strokeDasharray="3,4"
            />
            <text
              x={PAD_LEFT - 2} y={y + 3}
              fontSize="7" fill="rgba(68,86,181,0.45)"
              fontFamily="Space Grotesk, sans-serif"
              textAnchor="end"
            >
              {label}
            </text>
          </g>
        ))}

        {/* Filled area */}
        <polygon points={fillPts} fill="url(#elev-fill)" />

        {/* Profile line */}
        <polyline
          points={pts}
          fill="none"
          stroke="#4456b5"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X-axis distance labels */}
        {distLabels.map(({ x, label }) => (
          <text
            key={label}
            x={x.toFixed(1)} y={height - 4}
            fontSize="7" fill="rgba(68,86,181,0.38)"
            fontFamily="Space Grotesk, sans-serif"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}

        {/* Hover cursor */}
        {hover != null && (
          <>
            <line
              x1={hoverX.toFixed(1)} y1={PAD_TOP}
              x2={hoverX.toFixed(1)} y2={height - PAD_BOTTOM}
              stroke="rgba(68,86,181,0.5)" strokeWidth="1" strokeDasharray="3,3"
            />
            <circle
              cx={hoverX.toFixed(1)} cy={hoverY.toFixed(1)}
              r="4"
              fill="#4456b5"
              stroke="white"
              strokeWidth="1.5"
            />
          </>
        )}
      </svg>

      {/* Tooltip — positioned via normal DOM */}
      {hover != null && hoverPoint != null && (
        <HoverTooltip
          elev={hoverPoint}
          dist={hoverDist}
          svgFraction={(hoverX - PAD_LEFT) / (svgW - PAD_LEFT)}
        />
      )}
    </div>
  )
}

function distFmt(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

function HoverTooltip({
  elev, dist, svgFraction,
}: {
  elev: number
  dist: number | null
  svgFraction: number   // 0–1, used to flip tooltip side
}) {
  const onRight = svgFraction < 0.75
  return (
    <div
      style={{
        position: 'absolute',
        top: 4,
        ...(onRight
          ? { left: `calc(${(svgFraction * 100).toFixed(1)}% + 8px)` }
          : { right: `calc(${((1 - svgFraction) * 100).toFixed(1)}% + 8px)` }),
        background: 'var(--surface-variant)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(68,86,181,0.15)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: '0 2px 12px rgba(68,86,181,0.12)',
        padding: '0.3rem 0.5rem',
        pointerEvents: 'none',
        zIndex: 10,
        whiteSpace: 'nowrap',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.1rem',
      }}
    >
      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-family)' }}>
        {Math.round(elev)} м
      </span>
      {dist != null && (
        <span style={{ fontSize: '0.625rem', color: 'var(--primary)', opacity: 0.55, fontFamily: 'var(--font-family)' }}>
          {distFmt(dist)}
        </span>
      )}
    </div>
  )
}
