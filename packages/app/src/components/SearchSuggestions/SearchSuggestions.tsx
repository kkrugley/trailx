import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PhotonFeature } from '../../services/photon'
import { photonFeatureLabel } from '../../services/photon'
import { MapPin } from '@phosphor-icons/react'
import styles from './SearchSuggestions.module.css'

interface SearchSuggestionsProps {
  suggestions: PhotonFeature[]
  onSelect: (feature: PhotonFeature) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLInputElement>
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
      {suggestions.map((feature, i) => {
        const label = photonFeatureLabel(feature)
        return (
          <li key={i} role="option">
            <button
              className={styles.item}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(feature)
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
