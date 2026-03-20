import { Bicycle, Lightning, PersonSimpleWalk } from '@phosphor-icons/react'
import type { RoutingProfile } from '@trailx/shared'
import { useMapStore } from '../../store/useMapStore'
import { useProfile } from '../../hooks/useProfile'
import styles from './MobileHeader.module.css'

const PROFILE_ICONS: Record<RoutingProfile, typeof Bicycle> = {
  bike: Bicycle,
  racingbike: Lightning,
  foot: PersonSimpleWalk,
}

export function MobileHeader() {
  const { profile } = useProfile()
  const waypoints = useMapStore((s) => s.waypoints)

  const ProfileIcon = PROFILE_ICONS[profile]
  const start = waypoints[0]?.label ?? 'Choose starting point'
  const end = waypoints[waypoints.length - 1]?.label ?? 'Choose destination'

  return (
    <div className={styles.bar}>
      <div className={styles.profileIcon}>
        <ProfileIcon size={20} weight="fill" />
      </div>
      <div className={styles.inputs}>
        <span className={styles.inputLine} title={start}>{start}</span>
        <div className={styles.divider} />
        <span className={styles.inputLine} title={end}>{end}</span>
      </div>
    </div>
  )
}
