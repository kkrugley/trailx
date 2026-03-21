import { Bicycle, Lightning, PersonSimpleWalk, Mountains } from '@phosphor-icons/react'
import type { RoutingProfile } from '@trailx/shared'
import { useProfile } from '../../hooks/useProfile'
import styles from './ProfileTabs.module.css'

const PROFILES: { value: RoutingProfile; icon: typeof Bicycle; label: string }[] = [
  { value: 'foot', icon: PersonSimpleWalk, label: 'Пеший' },
  { value: 'bike', icon: Bicycle, label: 'Велосипед' },
  { value: 'mtb', icon: Mountains, label: 'Горный' },
  { value: 'racingbike', icon: Lightning, label: 'Шоссе' },
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
