import { useState } from 'react'
import { CaretUp, CaretDown, X } from '@phosphor-icons/react'
import { useMapStore } from '../../store/useMapStore'
import { Chip } from '../ui/Chip'
import { ElevationChart } from './ElevationChart'
import styles from './ElevationBar.module.css'

type ElevMode = 'compact' | 'expanded' | 'closed'

function formatElevation(m: number): string {
  return `${Math.round(m)} m`
}

function computeGain(elevation: number[]): number {
  return elevation.reduce(
    (acc, v, i) => (i > 0 && v > elevation[i - 1] ? acc + (v - elevation[i - 1]) : acc),
    0,
  )
}

export function ElevationBar() {
  const routeResult = useMapStore((s) => s.routeResult)
  const [mode, setMode] = useState<ElevMode>('compact')

  if (!routeResult || routeResult.elevation.length === 0) return null

  const { elevation } = routeResult
  const minElev = Math.min(...elevation)
  const maxElev = Math.max(...elevation)
  const gain = computeGain(elevation)

  if (mode === 'closed') {
    return (
      <button className={styles.reopenBtn} onClick={() => setMode('compact')} title="Show elevation">
        <CaretUp size={14} />
      </button>
    )
  }

  return (
    <div className={`${styles.bar} ${mode === 'expanded' ? styles.expanded : ''}`}>
      <div className={styles.header}>
        <span className={styles.label}>Elev.</span>
        <div className={styles.chips}>
          <Chip label={`+${formatElevation(gain)}`} title="Elevation gain" />
          <Chip label={`${formatElevation(minElev)}`} title="Min elevation" />
          <Chip label={`${formatElevation(maxElev)}`} title="Max elevation" />
        </div>
        <div className={styles.controls}>
          <button
            className={styles.controlBtn}
            onClick={() => setMode(mode === 'expanded' ? 'compact' : 'expanded')}
            title={mode === 'expanded' ? 'Collapse' : 'Expand'}
          >
            {mode === 'expanded' ? <CaretDown size={14} /> : <CaretUp size={14} />}
          </button>
          <button
            className={styles.controlBtn}
            onClick={() => setMode('closed')}
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {mode === 'expanded' && (
        <div className={styles.chart}>
          <ElevationChart elevation={elevation} height={80} />
        </div>
      )}
    </div>
  )
}
