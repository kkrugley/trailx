import { Clock, Path, ArrowUp } from '@phosphor-icons/react'
import type { RouteResult } from '@trailx/shared'
import { useMapStore } from '../../store/useMapStore'
import { fmtDist, fmtElev } from '../../utils/units'
import { Chip } from '../ui/Chip'
import styles from './CollapsedFooter.module.css'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

function computeGain(elevation: number[]): number {
  return elevation.reduce(
    (acc, v, i) => (i > 0 && v > elevation[i - 1] ? acc + (v - elevation[i - 1]) : acc),
    0,
  )
}

interface CollapsedFooterProps {
  result: RouteResult
  onClick?: () => void
}

export function CollapsedFooter({ result, onClick }: CollapsedFooterProps) {
  const unit = useMapStore((s) => s.appSettings.distanceUnit)
  const gain = computeGain(result.elevation)

  return (
    <div className={styles.row} onClick={onClick} role="button" tabIndex={0}>
      <Chip
        icon={<Clock size={12} weight="fill" />}
        label={formatDuration(result.duration)}
      />
      <Chip
        icon={<Path size={12} weight="fill" />}
        label={fmtDist(result.distance, unit)}
      />
      {gain > 0 && (
        <Chip
          icon={<ArrowUp size={12} weight="bold" />}
          label={`+${fmtElev(gain, unit)}`}
        />
      )}
    </div>
  )
}
