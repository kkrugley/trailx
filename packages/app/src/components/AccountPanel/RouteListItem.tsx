import { Trash, MapPin } from '@phosphor-icons/react'
import type { SavedRouteDTO, LocalRoute } from '@trailx/shared'
import styles from './RouteListItem.module.css'

interface RouteListItemProps {
  route: SavedRouteDTO | LocalRoute
  onLoad: () => void
  onDelete: () => void
}

function isDTO(r: SavedRouteDTO | LocalRoute): r is SavedRouteDTO {
  return 'distanceKm' in r
}

export function RouteListItem({ route, onLoad, onDelete }: RouteListItemProps) {
  const distanceKm = isDTO(route) ? route.distanceKm : null
  const profileId = isDTO(route) ? route.profileId : null

  return (
    <div className={styles.item}>
      <button className={styles.loadBtn} onClick={onLoad} aria-label={`Load route ${route.name}`}>
        <MapPin size={15} weight="regular" className={styles.icon} />
        <div className={styles.info}>
          <span className={styles.name}>{route.name}</span>
          {(distanceKm != null || profileId) && (
            <span className={styles.meta}>
              {distanceKm != null ? `${distanceKm.toFixed(1)} km` : ''}
              {distanceKm != null && profileId ? ' · ' : ''}
              {profileId ?? ''}
            </span>
          )}
        </div>
      </button>
      <button className={styles.deleteBtn} onClick={onDelete} aria-label={`Delete route ${route.name}`}>
        <Trash size={15} weight="regular" />
      </button>
    </div>
  )
}
