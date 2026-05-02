import { useState, useRef } from 'react'
import { Trash, Path, PencilSimple, Check, X } from '@phosphor-icons/react'
import type { SavedRouteDTO, LocalRoute, BotRouteDTO } from '@trailx/shared'
import styles from './RouteListItem.module.css'

interface RouteListItemProps {
  route: SavedRouteDTO | LocalRoute | BotRouteDTO
  onLoad: () => void
  onDelete?: () => void
  onRename?: (newName: string) => void
  readOnly?: boolean
}

function isBotDTO(r: SavedRouteDTO | LocalRoute | BotRouteDTO): r is BotRouteDTO {
  return 'groupId' in r && !('profileId' in r)
}

function isSavedDTO(r: SavedRouteDTO | LocalRoute | BotRouteDTO): r is SavedRouteDTO {
  return 'profileId' in r
}

export function RouteListItem({ route, onLoad, onDelete, onRename, readOnly }: RouteListItemProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(route.name)
  const inputRef = useRef<HTMLInputElement>(null)

  let distanceKm: number | null = null
  let profileId: string | null = null

  if (isBotDTO(route)) {
    distanceKm = route.distanceKm
  } else if (isSavedDTO(route)) {
    distanceKm = route.distanceKm
    profileId = route.profileId
  }

  function startEdit() {
    setEditValue(route.name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== route.name) {
      onRename?.(trimmed)
    }
    setEditing(false)
  }

  function cancelEdit() {
    setEditValue(route.name)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div className={styles.item}>
      {editing ? (
        <div className={styles.editRow}>
          <input
            ref={inputRef}
            className={styles.renameInput}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button className={styles.editActionBtn} onClick={commitEdit} aria-label="Save name">
            <Check size={13} weight="bold" />
          </button>
          <button className={styles.editActionBtn} onClick={cancelEdit} aria-label="Cancel">
            <X size={13} weight="bold" />
          </button>
        </div>
      ) : (
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
      )}
      {!readOnly && onRename && !editing && (
        <button className={styles.renameBtn} onClick={startEdit} aria-label={`Rename route ${route.name}`}>
          <PencilSimple size={14} weight="regular" />
        </button>
      )}
      {!readOnly && onDelete && !editing && (
        <button className={styles.deleteBtn} onClick={onDelete} aria-label={`Delete route ${route.name}`}>
          <Trash size={15} weight="regular" />
        </button>
      )}
    </div>
  )
}
