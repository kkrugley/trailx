import { useEffect } from 'react'
import {
  MagnifyingGlass,
  X,
  ArrowsDownUp,
  Funnel,
  ArrowRight,
} from '@phosphor-icons/react'
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp'
import { usePlatform } from '../../hooks/usePlatform'
import { useMapStore } from '../../store/useMapStore'
import styles from './ActionBar.module.css'

export function ActionBar() {
  const { webApp } = useTelegramWebApp()
  const { isTMA } = usePlatform()
  const isSearchOpen = useMapStore((s) => s.isSearchOpen)
  const isExportOpen = useMapStore((s) => s.isExportOpen)
  const { setSearchOpen, setExportOpen } = useMapStore((s) => s.actions)

  useEffect(() => {
    if (isTMA && webApp?.MainButton) {
      webApp.MainButton.hide()
    }
  }, [isTMA, webApp])

  return (
    <nav className={styles.bar} aria-label="Actions">
      <button
        className={`${styles.button} ${isSearchOpen ? styles.active : ''}`}
        aria-label={isSearchOpen ? 'Close search' : 'Search'}
        onClick={() => setSearchOpen(!isSearchOpen)}
      >
        {isSearchOpen ? (
          <X size={24} weight="regular" />
        ) : (
          <MagnifyingGlass size={24} weight="regular" />
        )}
      </button>
      <button className={styles.button} aria-label="Sort">
        <ArrowsDownUp size={24} weight="regular" />
      </button>
      <button className={styles.button} aria-label="Filter">
        <Funnel size={24} weight="regular" />
      </button>
      <button
        className={`${styles.button} ${isExportOpen ? styles.active : ''}`}
        aria-label={isExportOpen ? 'Close export' : 'Export'}
        onClick={() => setExportOpen(!isExportOpen)}
      >
        {isExportOpen ? (
          <X size={24} weight="regular" />
        ) : (
          <ArrowRight size={24} weight="regular" />
        )}
      </button>
    </nav>
  )
}
