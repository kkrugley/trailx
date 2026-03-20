import { Bicycle, Lightning, PersonSimpleWalk } from '@phosphor-icons/react'
import type { RoutingProfile } from '@trailx/shared'
import { useProfile } from '../../hooks/useProfile'
import styles from './ProfileTabs.module.css'

const PROFILES: { value: RoutingProfile; icon: typeof Bicycle; label: string }[] = [
  { value: 'bike', icon: Bicycle, label: 'Bike' },
  { value: 'racingbike', icon: Lightning, label: 'Racing' },
  { value: 'foot', icon: PersonSimpleWalk, label: 'Walk' },
]

export function ProfileTabs() {
  const { profile, setProfile } = useProfile()

  return (
    <div className={styles.row} role="tablist" aria-label="Routing profile">
      {PROFILES.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="tab"
          aria-selected={profile === value}
          aria-label={label}
          title={label}
          className={`${styles.tab} ${profile === value ? styles.active : ''}`}
          onClick={() => setProfile(value)}
        >
          <Icon size={20} weight={profile === value ? 'fill' : 'regular'} />
        </button>
      ))}
    </div>
  )
}
