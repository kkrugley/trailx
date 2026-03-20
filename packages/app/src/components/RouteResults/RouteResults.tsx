import { Clock, Path, ArrowUp } from '@phosphor-icons/react'
import type { RouteResult } from '@trailx/shared'
import { Chip } from '../ui/Chip'
import styles from './RouteResults.module.css'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

function computeGain(elevation: number[]): number {
  return elevation.reduce(
    (acc, v, i) => (i > 0 && v > elevation[i - 1] ? acc + (v - elevation[i - 1]) : acc),
    0,
  )
}

interface RouteResultsProps {
  result: RouteResult
}

export function RouteResults({ result }: RouteResultsProps) {
  const gain = computeGain(result.elevation)

  return (
    <div className={styles.wrapper}>
      <p className={styles.label}>Route</p>
      <div className={styles.card}>
        <div className={styles.chips}>
          <Chip
            icon={<Clock size={12} weight="fill" />}
            label={formatDuration(result.duration)}
            title="Duration"
          />
          <Chip
            icon={<Path size={12} weight="fill" />}
            label={formatDistance(result.distance)}
            title="Distance"
          />
          {gain > 0 && (
            <Chip
              icon={<ArrowUp size={12} weight="bold" />}
              label={`+${Math.round(gain)} m`}
              title="Elevation gain"
            />
          )}
        </div>
      </div>
    </div>
  )
}
