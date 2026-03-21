import { Bicycle, Lightning, PersonSimpleWalk, Mountains } from '@phosphor-icons/react'
import type { RoutingProfile } from '@trailx/shared'
import { useProfile } from '../../hooks/useProfile'
import styles from './ProfileTabs.module.css'

const PROFILES: { value: RoutingProfile; icon: typeof Bicycle; label: string; disabled?: boolean }[] = [
  { value: 'foot', icon: PersonSimpleWalk, label: 'Пеший' },
  { value: 'bike', icon: Bicycle, label: 'Велосипед' },
  { value: 'mtb', icon: Mountains, label: 'Горный', disabled: true },
  { value: 'racingbike', icon: Lightning, label: 'Шоссе', disabled: true },
]

export function ProfileTabs() {
  const { profile, setProfile } = useProfile()

  return (
    <div className={styles.row} role="tablist" aria-label="Routing profile">
      {PROFILES.map(({ value, icon: Icon, label, disabled }) => (
        <button
          key={value}
          role="tab"
          aria-selected={profile === value}
          aria-label={label}
          title={label}
          disabled={disabled}
          className={`${styles.tab} ${profile === value ? styles.active : ''}`}
          onClick={() => !disabled && setProfile(value)}
        >
          <Icon size={20} weight={profile === value ? 'fill' : 'regular'} />
        </button>
      ))}
    </div>
  )
}
