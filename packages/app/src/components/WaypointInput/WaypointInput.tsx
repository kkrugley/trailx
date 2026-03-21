import { useRef, useState } from 'react'
import { DotsSixVertical, X } from '@phosphor-icons/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { RoutePoint } from '@trailx/shared'
import type { PhotonFeature } from '../../services/photon'
import { photonFeatureLabel } from '../../services/photon'
import { usePhotonSearch } from '../../hooks/usePhotonSearch'
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

  const isResolved = !isNaN(point.lat)
  const defaultLabel = isResolved ? (point.label ?? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`) : ''
  const [inputValue, setInputValue] = useState(defaultLabel)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Sync label when point gets resolved externally (e.g. map click)
  if (isResolved && inputValue === '' && point.label) {
    setInputValue(point.label)
  }

  const { suggestions } = usePhotonSearch(showSuggestions ? inputValue : '')

  const handleSelect = (feature: PhotonFeature) => {
    const label = photonFeatureLabel(feature)
    const [lng, lat] = feature.geometry.coordinates
    setInputValue(label)
    setShowSuggestions(false)
    onUpdate(point.id, lat, lng, label)
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
