import { Bicycle, Lightning, PersonSimpleWalk, Mountains, Clock, Path, MapPin, DownloadSimple, ShareNetwork, Warning } from '@phosphor-icons/react'
import type { RoutingProfile } from '@trailx/shared'
import { useMapStore } from '../../store/useMapStore'
import { useProfile } from '../../hooks/useProfile'
import { exportRoute } from '../../services/gpx'
import { useShareSession } from '../../hooks/useShareSession'
import { fmtDist } from '../../utils/units'
import styles from './MobileHeader.module.css'

const PROFILE_ICONS: Record<RoutingProfile, typeof Bicycle> = {
  foot: PersonSimpleWalk,
  bike: Bicycle,
  mtb: Mountains,
  racingbike: Lightning,
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} ч ${m} мин`
  return `${m} мин`
}

function formatDurationCompact(seconds: number): string {
  const h = seconds / 3600
  if (h >= 1) return `${h.toFixed(1).replace('.0', '')} ч`
  return `${Math.round(seconds / 60)} мин`
}

export function MobileHeader() {
  const { profile } = useProfile()
  const routeResult = useMapStore((s) => s.routeResult)
  console.log('[TMA-DEBUG] MobileHeader render:', { hasRoute: !!routeResult, profile })
  const speeds = useMapStore((s) => s.appSettings.speeds)
  const unit = useMapStore((s) => s.appSettings.distanceUnit)
  const { share, isSharing, error, clearError } = useShareSession()

  const ProfileIcon = PROFILE_ICONS[profile]

  if (routeResult) {
    const speedKmh = speeds[profile]
    const durationSec = (routeResult.distance / 1000 / speedKmh) * 3600

    return (
      <div className={styles.bar}>
        <div className={styles.profileIcon}>
          <ProfileIcon size={20} weight="fill" />
        </div>
        <div className={styles.stats}>
          <span className={`${styles.statChipAccent} ${styles.durationFull}`}>
            <Clock size={12} weight="fill" />
            {formatDuration(durationSec)}
          </span>
          <span className={`${styles.statChipAccent} ${styles.durationCompact}`}>
            <Clock size={12} weight="fill" />
            {formatDurationCompact(durationSec)}
          </span>
          <span className={styles.statChip}>
            <Path size={12} weight="fill" />
            {fmtDist(routeResult.distance, unit)}
          </span>
        </div>
        <div className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${error ? styles.actionBtnError : ''}`}
            onClick={error ? clearError : share}
            disabled={isSharing}
            aria-label={error ? error : 'Поделиться'}
            title={error ?? 'Поделиться'}
          >
            {error
              ? <Warning size={16} weight="fill" />
              : <ShareNetwork size={16} weight="regular" />
            }
          </button>
          <button className={styles.actionBtn} onClick={exportRoute} aria-label="Скачать GPX" title="Скачать GPX">
            <DownloadSimple size={16} weight="regular" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.bar}>
      <div className={styles.hintIcon}>
        <MapPin size={18} weight="duotone" />
      </div>
      <p className={styles.hintText}>Добавьте точки маршрута в выдвижном меню</p>
    </div>
  )
}
