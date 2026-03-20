import { useEffect } from 'react'
import {
  MagnifyingGlass,
  ArrowsDownUp,
  Funnel,
  ArrowRight,
} from '@phosphor-icons/react'
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp'
import { usePlatform } from '../../hooks/usePlatform'
import styles from './ActionBar.module.css'

export function ActionBar() {
  const { webApp } = useTelegramWebApp()
  const { isTMA } = usePlatform()

  useEffect(() => {
    if (isTMA && webApp?.MainButton) {
      webApp.MainButton.hide()
    }
  }, [isTMA, webApp])

  return (
    <nav className={styles.bar} aria-label="Actions">
      <button className={styles.button} aria-label="Search">
        <MagnifyingGlass size={24} weight="regular" />
      </button>
      <button className={styles.button} aria-label="Sort">
        <ArrowsDownUp size={24} weight="regular" />
      </button>
      <button className={styles.button} aria-label="Filter">
        <Funnel size={24} weight="regular" />
      </button>
      <button className={styles.button} aria-label="Export">
        <ArrowRight size={24} weight="regular" />
      </button>
    </nav>
  )
}
