import { useState } from 'react'
import { fmtDist, type DistanceUnit } from '../../utils/units'

interface RoadClassChartProps {
  roadClass: string[]
  distance?: number
  unit?: DistanceUnit
  onHoverFraction?: (fraction: number | null) => void
}

const ROAD_CLASS_COLORS: Record<string, string> = {
  motorway:     '#e05050',
  trunk:        '#e07030',
  primary:      '#d09030',
  secondary:    '#c0b030',
  tertiary:     '#9aaa40',
  residential:  '#5a9a5a',
  service:      '#6aaa8a',
  unclassified: '#7a8aaa',
  track:        '#b08050',
  cycleway:     '#4456b5',
  path:         '#6a78c5',
  footway:      '#8a96d5',
  steps:        '#aa96b5',
  bridleway:    '#8a7a50',
  ferry:        '#50a0c0',
  unknown:      '#aaaaaa',
  other:        '#aaaaaa',
}

function roadColor(s: string): string {
  return ROAD_CLASS_COLORS[s] ?? ROAD_CLASS_COLORS.other
}


interface Segment {
  value: string
  start: number
  end: number
}

function buildSegments(data: string[]): Segment[] {
  if (data.length === 0) return []
  const segments: Segment[] = []
  let cur = data[0]
  let startIdx = 0
  const n = data.length
  for (let i = 1; i <= n; i++) {
    if (i === n || data[i] !== cur) {
      segments.push({ value: cur, start: startIdx / n, end: i / n })
      cur = data[i]
      startIdx = i
    }
  }
  return segments
}

export function RoadClassChart({ roadClass, distance, unit = 'km', onHoverFraction }: RoadClassChartProps) {
  const [hoverSeg, setHoverSeg] = useState<Segment | null>(null)
  const segments = buildSegments(roadClass)

  const totals: Record<string, number> = {}
  for (const s of roadClass) totals[s] = (totals[s] ?? 0) + 1
  const legend = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, pct: count / roadClass.length }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Segmented bar + absolute tooltip */}
      <div
        style={{ position: 'relative', paddingBottom: '1.25rem' }}
        onMouseLeave={() => { setHoverSeg(null); onHoverFraction?.(null) }}
      >
        <div
          style={{
            height: '24px',
            borderRadius: '4px',
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          {segments.map((seg, i) => (
            <div
              key={i}
              style={{
                flex: seg.end - seg.start,
                background: roadColor(seg.value),
                opacity: hoverSeg && hoverSeg !== seg ? 0.5 : 1,
                transition: 'opacity 0.12s',
                cursor: 'default',
              }}
              onMouseEnter={() => { setHoverSeg(seg); onHoverFraction?.((seg.start + seg.end) / 2) }}
            />
          ))}
        </div>

        {/* Tooltip — absolute, no layout shift */}
        <div style={{
          position: 'absolute',
          top: '28px',
          left: 0,
          height: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.6875rem',
          fontFamily: 'var(--font-family)',
          color: 'var(--primary)',
          opacity: hoverSeg ? 1 : 0,
          transition: 'opacity 0.1s',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: hoverSeg ? roadColor(hoverSeg.value) : 'transparent', flexShrink: 0, display: 'inline-block' }} />
          <strong>{hoverSeg?.value}</strong>
          {distance && hoverSeg && (
            <span style={{ opacity: 0.55 }}>
              {fmtDist((hoverSeg.end - hoverSeg.start) * distance, unit)}
              {' '}({Math.round((hoverSeg.end - hoverSeg.start) * 100)}%)
            </span>
          )}
        </div>
      </div>

      {distance && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.5625rem', color: 'rgba(68,86,181,0.45)', fontFamily: 'var(--font-family)' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <span key={f}>{fmtDist(distance * f, unit)}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem 0.625rem' }}>
        {legend.map(({ value, pct }) => (
          <div key={value} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.5875rem', fontFamily: 'var(--font-family)', color: 'var(--primary)', opacity: 0.7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: roadColor(value), flexShrink: 0, display: 'inline-block' }} />
            {value} <span style={{ opacity: 0.6 }}>{Math.round(pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
