import { useEffect, useRef } from 'react'
import type { PhotonFeature } from '../../services/photon'
import { photonFeatureLabel } from '../../services/photon'
import { MapPin } from '@phosphor-icons/react'
import styles from './SearchSuggestions.module.css'

interface SearchSuggestionsProps {
  suggestions: PhotonFeature[]
  onSelect: (feature: PhotonFeature) => void
  onClose: () => void
}

export function SearchSuggestions({ suggestions, onSelect, onClose }: SearchSuggestionsProps) {
  const ref = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  if (suggestions.length === 0) return null

  return (
    <ul ref={ref} className={styles.list} role="listbox">
      {suggestions.map((feature, i) => {
        const label = photonFeatureLabel(feature)
        return (
          <li key={i} role="option">
            <button
              className={styles.item}
              onMouseDown={(e) => {
                e.preventDefault() // prevent input blur before click registers
                onSelect(feature)
              }}
            >
              <MapPin size={14} weight="fill" className={styles.icon} />
              <span className={styles.label}>{label}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
