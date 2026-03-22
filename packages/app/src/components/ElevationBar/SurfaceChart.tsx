import { useState } from 'react'
import { fmtDist, type DistanceUnit } from '../../utils/units'

interface SurfaceChartProps {
  surface: string[]
  distance?: number
  unit?: DistanceUnit
  onHoverFraction?: (fraction: number | null) => void
}

const SURFACE_COLORS: Record<string, string> = {
  asphalt:       '#4456b5',
  paved:         '#5567c5',
  concrete:      '#6478d5',
  cobblestone:   '#8a6aa0',
  sett:          '#9a7ab0',
  paving_stones: '#7a89c5',
  compacted:     '#6aaa7a',
  gravel:        '#c8a05a',
  fine_gravel:   '#d8b06a',
  pebblestone:   '#c89060',
  ground:        '#b87840',
  dirt:          '#a06830',
  sand:          '#e0c060',
  grass:         '#5a9a5a',
  mud:           '#907050',
  wood:          '#a07040',
  unpaved:       '#b08050',
  unknown:       '#aaaaaa',
}

function surfaceColor(s: string): string {
  return SURFACE_COLORS[s] ?? SURFACE_COLORS.unknown
}


interface Segment {
  value: string
  start: number  // fraction 0-1
  end: number
}

function buildSegments(surface: string[]): Segment[] {
  if (surface.length === 0) return []
  const segments: Segment[] = []
  let cur = surface[0]
  let startIdx = 0
  const n = surface.length
  for (let i = 1; i <= n; i++) {
    if (i === n || surface[i] !== cur) {
      segments.push({ value: cur, start: startIdx / n, end: i / n })
      cur = surface[i]
      startIdx = i
    }
  }
  return segments
}

export function SurfaceChart({ surface, distance, unit = 'km', onHoverFraction }: SurfaceChartProps) {
  const [hoverSeg, setHoverSeg] = useState<Segment | null>(null)
  const segments = buildSegments(surface)

  // Build legend: unique values sorted by share
  const totals: Record<string, number> = {}
  for (const s of surface) totals[s] = (totals[s] ?? 0) + 1
  const legend = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, pct: count / surface.length }))

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
                background: surfaceColor(seg.value),
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
          <span style={{ width: 9, height: 9, borderRadius: 2, background: hoverSeg ? surfaceColor(hoverSeg.value) : 'transparent', flexShrink: 0, display: 'inline-block' }} />
          <strong>{hoverSeg?.value}</strong>
          {distance && hoverSeg && (
            <span style={{ opacity: 0.55 }}>
              {fmtDist((hoverSeg.end - hoverSeg.start) * distance, unit)}
              {' '}({Math.round((hoverSeg.end - hoverSeg.start) * 100)}%)
            </span>
          )}
        </div>
      </div>

      {/* X-axis distance markers */}
      {distance && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.5625rem', color: 'rgba(68,86,181,0.45)', fontFamily: 'var(--font-family)' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <span key={f}>{fmtDist(distance * f, unit)}</span>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem 0.625rem' }}>
        {legend.map(({ value, pct }) => (
          <div key={value} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.5875rem', fontFamily: 'var(--font-family)', color: 'var(--primary)', opacity: 0.7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: surfaceColor(value), flexShrink: 0, display: 'inline-block' }} />
            {value} <span style={{ opacity: 0.6 }}>{Math.round(pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
