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
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  MapPin,
  Flag,
  FlagCheckered,
  DotsSixVertical,
  Trash,
} from '@phosphor-icons/react'
import type { RoutePoint } from '@trailx/shared'
import { useRoute } from '../../hooks/useRoute'
import styles from './RoutePanel.module.css'

// ── Sortable waypoint item ───────────────────────────────────────────────────

interface WaypointItemProps {
  point: RoutePoint
  onRemove: (id: string) => void
}

function WaypointItem({ point, onRemove }: WaypointItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: point.id })

  // dnd-kit requires inline styles for the drag transform — unavoidable
  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const TypeIcon =
    point.type === 'start'
      ? Flag
      : point.type === 'end'
        ? FlagCheckered
        : MapPin

  const label =
    point.label ?? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`

  return (
    <li
      ref={setNodeRef}
      style={dragStyle}
      className={`${styles.item} ${isDragging ? styles.dragging : ''}`}
    >
      <button
        className={styles.dragHandle}
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={20} weight="regular" />
      </button>

      <span className={styles.itemIcon}>
        <TypeIcon size={20} weight="regular" />
      </span>

      <span className={styles.itemLabel}>{label}</span>

      <button
        className={styles.removeButton}
        onClick={() => onRemove(point.id)}
        aria-label={`Remove ${label}`}
      >
        <Trash size={20} weight="regular" />
      </button>
    </li>
  )
}

// ── RoutePanel ───────────────────────────────────────────────────────────────

export function RoutePanel() {
  const { waypoints, removeWaypoint, reorderWaypoints, clearRoute } =
    useRoute()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const fromIndex = waypoints.findIndex((p) => p.id === active.id)
      const toIndex = waypoints.findIndex((p) => p.id === over.id)
      if (fromIndex !== -1 && toIndex !== -1) {
        reorderWaypoints(fromIndex, toIndex)
      }
    },
    [waypoints, reorderWaypoints],
  )

  if (waypoints.length === 0) {
    return (
      <div className={styles.empty}>
        <MapPin size={32} weight="light" />
        <p className={styles.emptyText}>Добавь точки на карте</p>
      </div>
    )
  }

  const ids = waypoints.map((p) => p.id)

  return (
    <div className={styles.panel}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className={styles.list}>
            {waypoints.map((point) => (
              <WaypointItem
                key={point.id}
                point={point}
                onRemove={removeWaypoint}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <button className={styles.clearButton} onClick={clearRoute}>
        Очистить маршрут
      </button>
    </div>
  )
}
