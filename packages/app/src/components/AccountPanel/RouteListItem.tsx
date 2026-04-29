import { Trash, Path } from '@phosphor-icons/react'
import type { SavedRouteDTO, LocalRoute, BotRouteDTO } from '@trailx/shared'
import styles from './RouteListItem.module.css'

interface RouteListItemProps {
  route: SavedRouteDTO | LocalRoute | BotRouteDTO
  onLoad: () => void
  onDelete?: () => void
  readOnly?: boolean
}

function isBotDTO(r: SavedRouteDTO | LocalRoute | BotRouteDTO): r is BotRouteDTO {
  return 'groupId' in r
}

function isSavedDTO(r: SavedRouteDTO | LocalRoute | BotRouteDTO): r is SavedRouteDTO {
  return 'profileId' in r
}

export function RouteListItem({ route, onLoad, onDelete, readOnly }: RouteListItemProps) {
  let distanceKm: number | null = null
  let profileId: string | null = null

  if (isBotDTO(route)) {
    distanceKm = route.distanceKm
  } else if (isSavedDTO(route)) {
    distanceKm = route.distanceKm
    profileId = route.profileId
  }

  return (
    <div className={styles.item}>
      <button className={styles.loadBtn} onClick={onLoad} aria-label={`Load route ${route.name}`}>
        <Path size={14} weight="regular" className={styles.icon} />
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
      {!readOnly && onDelete && (
        <button className={styles.deleteBtn} onClick={onDelete} aria-label={`Delete route ${route.name}`}>
          <Trash size={15} weight="regular" />
        </button>
      )}
    </div>
  )
}
