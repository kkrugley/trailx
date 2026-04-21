import { Bicycle, Lightning, PersonSimpleWalk, Mountains } from '@phosphor-icons/react'
import type { RoutingProfile } from '@trailx/shared'
import { useProfile } from '../../hooks/useProfile'
import { useT } from '../../i18n/useT'
import styles from './ProfileTabs.module.css'

const PROFILE_ICONS: { value: RoutingProfile; icon: typeof Bicycle; disabled?: boolean }[] = [
  { value: 'foot', icon: PersonSimpleWalk },
  { value: 'bike', icon: Bicycle },
  { value: 'mtb', icon: Mountains, disabled: true },
  { value: 'racingbike', icon: Lightning, disabled: true },
]

export function ProfileTabs() {
  const { profile, setProfile } = useProfile()
  const t = useT()

  return (
    <div className={styles.row} role="tablist" aria-label="Routing profile">
      {PROFILE_ICONS.map(({ value, icon: Icon, disabled }) => {
        const label = t.profileTabs[value]
        return (
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
        )
      })}
    </div>
  )
}
