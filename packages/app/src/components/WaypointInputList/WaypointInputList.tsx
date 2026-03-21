import { useCallback, useRef, useState } from 'react'
import { Plus, GearSix, Trash } from '@phosphor-icons/react'
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
import styles from './WaypointInputList.module.css'

const PLACEHOLDERS: Record<string, string> = {
  start: 'Начальная точка',
  intermediate: 'Промежуточная точка',
  end: 'Конечная точка',
}

export function WaypointInputList() {
  const { waypoints, removeWaypoint, reorderWaypoints, clearRoute } = useRoute()
  const { updateWaypoint, addEmptyIntermediate } = useMapStore((s) => s.actions)
  const { profile } = useProfile()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)

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

  return (
    <div className={styles.wrapper}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className={styles.list}>
            {waypoints.map((point) => (
              <WaypointInput
                key={point.id}
                point={point}
                placeholder={PLACEHOLDERS[point.type] ?? 'Промежуточная точка'}
                onRemove={removeWaypoint}
                onUpdate={updateWaypoint}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {/* Actions row */}
      <div className={styles.actionsRow}>
        <button className={styles.addBtn} onClick={addEmptyIntermediate}>
          <Plus size={13} weight="bold" />
          Добавить остановку
        </button>
        <button
          ref={settingsBtnRef}
          className={`${styles.iconBtn} ${settingsOpen ? styles.iconBtnActive : ''}`}
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="Настройки маршрута"
          title="Настройки"
        >
          <GearSix size={16} weight={settingsOpen ? 'fill' : 'regular'} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={clearRoute}
          aria-label="Очистить маршрут"
          title="Очистить маршрут"
        >
          <Trash size={16} weight="regular" />
        </button>
      </div>

      {settingsOpen && (
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
