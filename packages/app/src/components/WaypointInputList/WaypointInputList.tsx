import { useCallback } from 'react'
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
import { useMapStore } from '../../store/useMapStore'
import { useRoute } from '../../hooks/useRoute'
import styles from './WaypointInputList.module.css'

const PLACEHOLDERS: Record<string, string> = {
  start: 'Choose starting point',
  intermediate: 'Add stop',
  end: 'Choose destination',
}

export function WaypointInputList() {
  const { waypoints, removeWaypoint, reorderWaypoints } = useRoute()
  const { addWaypoint } = useMapStore((s) => s.actions)

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

  const handleSelect = useCallback(
    (id: string, lat: number, lng: number, label: string) => {
      const point = waypoints.find((p) => p.id === id)
      if (!point) return
      // Remove old, re-add with new coords — keeps order/type via store
      removeWaypoint(id)
      addWaypoint({ ...point, lat, lng, label })
    },
    [waypoints, removeWaypoint, addWaypoint],
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
                placeholder={PLACEHOLDERS[point.type] ?? 'Add stop'}
                onRemove={removeWaypoint}
                onSelect={handleSelect}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {waypoints.length === 0 && (
        <p className={styles.hint}>Click the map to add waypoints</p>
      )}
    </div>
  )
}
