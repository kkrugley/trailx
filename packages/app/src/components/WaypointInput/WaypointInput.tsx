import { useRef, useState } from 'react'
import { DotsSixVertical, X } from '@phosphor-icons/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { RoutePoint } from '@trailx/shared'
import type { NominatimResult } from '../../services/nominatim'
import { nominatimLabel } from '../../services/nominatim'
import { useNominatimSearch } from '../../hooks/useNominatimSearch'
import { SearchSuggestions } from '../SearchSuggestions/SearchSuggestions'
import styles from './WaypointInput.module.css'

interface WaypointInputProps {
  point: RoutePoint
  placeholder: string
  onRemove: (id: string) => void
  onUpdate: (id: string, lat: number, lng: number, label: string) => void
}

const TYPE_COLORS: Record<RoutePoint['type'], string> = {
  start: '#27ae60',
  end: '#e74c3c',
  intermediate: '#4456b5',
}

export function WaypointInput({ point, placeholder, onRemove, onUpdate }: WaypointInputProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: point.id })

  const inputRef = useRef<HTMLInputElement>(null)

  // isNaN(null) === false in JS (null coerces to 0), so an explicit typeof guard is
  // required — persisted NaN waypoints deserialize to null via JSON round-trip.
  const isResolved = typeof point.lat === 'number' && !isNaN(point.lat)
  const defaultLabel = isResolved ? (point.label ?? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`) : ''
  const [inputValue, setInputValue] = useState(defaultLabel)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Sync inputValue when the point is updated externally (map click, context menu,
  // or async reverse-geocode label update). Track id+coords+label so any of the
  // three changes triggers a sync.
  // NOTE: NaN !== NaN is always true in JS, so we need explicit NaN handling.
  const prevPointRef = useRef<{ id: string; lat: number; lng: number; label: string | undefined } | null>(null)
  const prev = prevPointRef.current
  const sameNum = (a: number, b: number) => (isNaN(a) && isNaN(b)) || a === b
  const externallyChanged =
    !prev ||
    prev.id !== point.id ||
    !sameNum(prev.lat, point.lat) ||
    !sameNum(prev.lng, point.lng) ||
    prev.label !== point.label
  if (externallyChanged) {
    prevPointRef.current = { id: point.id, lat: point.lat, lng: point.lng, label: point.label }
    if (isResolved) {
      const newLabel = point.label ?? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`
      if (inputValue !== newLabel) setInputValue(newLabel)
    } else {
      if (inputValue !== '') setInputValue('')
    }
  }

  const { suggestions } = useNominatimSearch(showSuggestions ? inputValue : '')

  const handleSelect = (result: NominatimResult) => {
    const label = nominatimLabel(result)
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    setInputValue(label)
    setShowSuggestions(false)
    onUpdate(point.id, lat, lng, label)
    window.dispatchEvent(new CustomEvent('trailx:flyto', { detail: { lat, lng } }))
  }

  return (
    <li
      ref={setNodeRef}
      className={styles.row}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
    >
      <button
        className={styles.dragHandle}
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={18} weight="regular" />
      </button>

      <span
        className={styles.dot}
        style={{ background: TYPE_COLORS[point.type] }}
      />

      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={inputValue}
          placeholder={placeholder}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        />
        {showSuggestions && suggestions.length > 0 && (
          <SearchSuggestions
            suggestions={suggestions}
            onSelect={handleSelect}
            onClose={() => setShowSuggestions(false)}
            anchorRef={inputRef}
          />
        )}
      </div>

      <button
        className={styles.removeBtn}
        onClick={() => onRemove(point.id)}
        aria-label="Remove waypoint"
      >
        <X size={16} weight="bold" />
      </button>
    </li>
  )
}
