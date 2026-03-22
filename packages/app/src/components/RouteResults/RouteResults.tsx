import { useState } from 'react'
import { Clock, Path, ArrowUp, ArrowDown, Gauge } from '@phosphor-icons/react'
import type { RouteResult } from '@trailx/shared'
import { useMapStore } from '../../store/useMapStore'
import { fmtDist, fmtElev, fmtSpeed } from '../../utils/units'
import styles from './RouteResults.module.css'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} ч ${m} мин`
  return `${m} мин`
}

function computeGain(elevation: number[]): number {
  return elevation.reduce(
    (acc, v, i) => (i > 0 && v > elevation[i - 1] ? acc + (v - elevation[i - 1]) : acc),
    0,
  )
}

function computeLoss(elevation: number[]): number {
  return elevation.reduce(
    (acc, v, i) => (i > 0 && v < elevation[i - 1] ? acc + (elevation[i - 1] - v) : acc),
    0,
  )
}

interface StatChipProps {
  icon: React.ReactNode
  label: string
  tooltip: string
  accent?: boolean
}

function StatChip({ icon, label, tooltip, accent }: StatChipProps) {
  const [show, setShow] = useState(false)
  return (
    <div
      className={`${styles.chip} ${accent ? styles.chipAccent : ''}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className={styles.chipIcon}>{icon}</span>
      <span className={styles.chipLabel}>{label}</span>
      {show && (
        <div className={styles.tooltip}>
          {tooltip}
        </div>
      )}
    </div>
  )
}

interface RouteResultsProps {
  result: RouteResult
}

export function RouteResults({ result }: RouteResultsProps) {
  const profile = useMapStore((s) => s.profile)
  const speeds = useMapStore((s) => s.appSettings.speeds)
  const unit = useMapStore((s) => s.appSettings.distanceUnit)

  const gain = computeGain(result.elevation)
  const loss = computeLoss(result.elevation)
  const speedKmh = speeds[profile]
  const customDurationSec = (result.distance / 1000 / speedKmh) * 3600

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <p className={styles.label}>Маршрут</p>
        <span className={styles.speedBadge}>
          <Gauge size={10} weight="fill" />
          {fmtSpeed(speedKmh, unit)}
        </span>
      </div>
      <div className={styles.card}>
        <div className={styles.chips}>
          <StatChip
            icon={<Clock size={12} weight="fill" />}
            label={formatDuration(customDurationSec)}
            tooltip={`Расчётное время при скорости ${fmtSpeed(speedKmh, unit)}`}
            accent
          />
          <StatChip
            icon={<Path size={12} weight="fill" />}
            label={fmtDist(result.distance, unit)}
            tooltip="Общая длина маршрута"
          />
          {gain > 0 && (
            <StatChip
              icon={<ArrowUp size={12} weight="bold" />}
              label={`+${fmtElev(gain, unit)}`}
              tooltip="Суммарный набор высоты"
            />
          )}
          {loss > 0 && (
            <StatChip
              icon={<ArrowDown size={12} weight="bold" />}
              label={`−${fmtElev(loss, unit)}`}
              tooltip="Суммарный сброс высоты"
            />
          )}
        </div>
      </div>
    </div>
  )
}
