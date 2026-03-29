import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { NominatimResult } from '../../services/nominatim'
import { nominatimLabel } from '../../services/nominatim'
import { MapPin } from '@phosphor-icons/react'
import styles from './SearchSuggestions.module.css'

interface SearchSuggestionsProps {
  suggestions: NominatimResult[]
  onSelect: (result: NominatimResult) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLInputElement | null>
}

export function SearchSuggestions({ suggestions, onSelect, onClose, anchorRef }: SearchSuggestionsProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  useLayoutEffect(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    })
  }, [anchorRef, suggestions])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        listRef.current && !listRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose, anchorRef])

  if (suggestions.length === 0) return null

  return createPortal(
    <ul ref={listRef} className={styles.list} role="listbox" style={style}>
      {suggestions.map((result) => {
        const label = nominatimLabel(result)
        return (
          <li key={result.place_id} role="option">
            <button
              className={styles.item}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(result)
              }}
            >
              <MapPin size={14} weight="fill" className={styles.icon} />
              <span className={styles.label}>{label}</span>
            </button>
          </li>
        )
      })}
    </ul>,
    document.body,
  )
}
