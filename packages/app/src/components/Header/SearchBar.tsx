import { useEffect, useRef, useState } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { parseCoordinates } from '@trailx/shared'
import { useRoute } from '../../hooks/useRoute'
import { searchPlaces } from '../../services/photon'
import type { SearchResult } from '../../services/photon'
import styles from './SearchBar.module.css'

const DEBOUNCE_MS = 300

/**
 * Returns true if the input looks like it's intended as coordinates
 * (matches the numeric lat/lng pattern) but may be out of range.
 */
function mightBeCoordinates(input: string): boolean {
  return /^\s*-?\d+(?:\.\d+)?[\s,]+-?\d+(?:\.\d+)?\s*$/.test(input.trim()) || /°/.test(input)
}

function flyTo(lat: number, lng: number): void {
  window.dispatchEvent(new CustomEvent('trailx:flyto', { detail: { lat, lng } }))
}

interface SearchBarProps {
  onClose?: () => void
}

export function SearchBar({ onClose }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [coordError, setCoordError] = useState<string | null>(null)

  const { addWaypoint } = useRoute()
  // Stable refs so closures inside useEffect always see latest values
  const addWaypointRef = useRef(addWaypoint)
  useEffect(() => { addWaypointRef.current = addWaypoint }, [addWaypoint])
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  function clearSearch() {
    setQuery('')
    setResults([])
    setCoordError(null)
  }

  function handleSelect(result: SearchResult) {
    addWaypointRef.current(result.lat, result.lng, result.name)
    flyTo(result.lat, result.lng)
    clearSearch()
    onCloseRef.current?.()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      clearSearch()
      onCloseRef.current?.()
      return
    }
    if (e.key === 'Enter' && query.trim()) {
      const coords = parseCoordinates(query)
      if (coords) {
        addWaypointRef.current(coords.lat, coords.lng)
        flyTo(coords.lat, coords.lng)
        clearSearch()
        onCloseRef.current?.()
      } else if (mightBeCoordinates(query)) {
        setCoordError('Coordinates out of range. Lat: −90..90, Lng: −180..180')
      } else if (results.length > 0) {
        handleSelect(results[0])
      }
    }
  }

  // Debounced search / coordinate detection
  useEffect(() => {
    setCoordError(null)

    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    const timerId = setTimeout(() => {
      // Coordinate match → add immediately without Photon call
      const coords = parseCoordinates(query)
      if (coords) {
        addWaypointRef.current(coords.lat, coords.lng)
        flyTo(coords.lat, coords.lng)
        setQuery('')
        setResults([])
        onCloseRef.current?.()
        return
      }

      // Looks like coordinates but out of range
      if (mightBeCoordinates(query)) {
        setCoordError('Coordinates out of range. Lat: −90..90, Lng: −180..180')
        setResults([])
        return
      }

      // Regular text search
      setLoading(true)
      searchPlaces(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, DEBOUNCE_MS)

    return () => clearTimeout(timerId)
  }, [query])

  const showDropdown = results.length > 0 && query.trim().length > 0

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper}>
        {loading ? (
          <span className={styles.spinner} aria-hidden />
        ) : (
          <MagnifyingGlass size={18} weight="regular" className={styles.icon} aria-hidden />
        )}
        <input
          className={styles.input}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCoordError(null) }}
          onKeyDown={handleKeyDown}
          placeholder="Search place or coordinates…"
          aria-label="Search places"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button className={styles.clearButton} onClick={clearSearch} aria-label="Clear search">
            <X size={14} weight="bold" />
          </button>
        )}
      </div>

      {coordError && (
        <div className={styles.coordError} role="alert">
          {coordError}
        </div>
      )}

      {showDropdown && (
        <ul className={styles.dropdown} role="listbox" aria-label="Search results">
          {results.map((r, i) => (
            <li
              key={i}
              className={styles.result}
              role="option"
              aria-selected="false"
              onClick={() => handleSelect(r)}
            >
              <span className={styles.resultName}>{r.name}</span>
              {r.address && <span className={styles.resultAddress}>{r.address}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
