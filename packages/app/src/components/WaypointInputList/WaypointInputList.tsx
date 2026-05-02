import { useCallback, useRef, useState } from 'react'
import { Plus, GearSix, Trash, Eye } from '@phosphor-icons/react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { WaypointInput } from '../WaypointInput/WaypointInput'
import { RouteSettings } from '../RouteSettings/RouteSettings'
import { useMapStore } from '../../store/useMapStore'
import { useRoute } from '../../hooks/useRoute'
import { useProfile } from '../../hooks/useProfile'
import { useRoutePermissions } from '../../hooks/useRoutePermissions'
import { useT } from '../../i18n/useT'
import styles from './WaypointInputList.module.css'

export function WaypointInputList() {
  const { waypoints, removeWaypoint, reorderWaypoints, clearRoute } = useRoute()
  const { updateWaypoint, addEmptyIntermediate } = useMapStore((s) => s.actions)
  const { profile } = useProfile()
  const { canEdit, source } = useRoutePermissions()
  const t = useT()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)

  const placeholders: Record<string, string> = {
    start: t.waypointInputList.placeholderStart,
    intermediate: t.waypointInputList.placeholderIntermediate,
    end: t.waypointInputList.placeholderEnd,
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const from = waypoints.findIndex((p) => p.id === active.id)
      const to = waypoints.findIndex((p) => p.id === over.id)
      if (from !== -1 && to !== -1) reorderWaypoints(from, to)
    },
    [waypoints, reorderWaypoints],
  )

  const ids = waypoints.map((p) => p.id)

  const readOnlyLabel = !canEdit
    ? source?.kind === 'group'
      ? 'Только просмотр — маршрут группы'
      : 'Только просмотр — нужна ссылка для редактирования'
    : null

  return (
    <div className={styles.wrapper}>
      {readOnlyLabel && (
        <div className={styles.readOnlyBanner}>
          <Eye size={13} weight="regular" />
          {readOnlyLabel}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={canEdit ? handleDragEnd : () => undefined}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className={styles.list}>
            {waypoints.map((point) => (
              <WaypointInput
                key={point.id}
                point={point}
                placeholder={placeholders[point.type] ?? t.waypointInputList.placeholderIntermediate}
                onRemove={canEdit ? removeWaypoint : () => undefined}
                onUpdate={canEdit ? updateWaypoint : () => undefined}
                readOnly={!canEdit}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {/* Actions row — hidden in read-only mode */}
      {canEdit && (
        <div className={styles.actionsRow}>
          <button className={styles.addBtn} onClick={addEmptyIntermediate}>
            <Plus size={13} weight="bold" />
            {t.waypointInputList.addStop}
          </button>
          <button
            ref={settingsBtnRef}
            className={`${styles.iconBtn} ${settingsOpen ? styles.iconBtnActive : ''}`}
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label={t.waypointInputList.settingsAriaLabel}
            title={t.waypointInputList.settingsTitle}
          >
            <GearSix size={16} weight={settingsOpen ? 'fill' : 'regular'} />
          </button>
          <button
            className={styles.iconBtn}
            onClick={clearRoute}
            aria-label={t.waypointInputList.clearAriaLabel}
            title={t.waypointInputList.clearTitle}
          >
            <Trash size={16} weight="regular" />
          </button>
        </div>
      )}

      {settingsOpen && canEdit && (
        <div className={styles.settingsWrapper}>
          <RouteSettings
            profile={profile}
            onClose={() => setSettingsOpen(false)}
            anchorRef={settingsBtnRef}
          />
        </div>
      )}
    </div>
  )
}
