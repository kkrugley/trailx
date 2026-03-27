import { useEffect } from 'react'
import { AppShell } from './components/shell/AppShell'
import { useTelegramWebApp } from './hooks/useTelegramWebApp'
import { useRouteSync } from './hooks/useRouteSync'
import { useSessionLoader } from './hooks/useSessionLoader'
import { useMapStore } from './store/useMapStore'
import styles from './App.module.css'

export function App() {
  useRouteSync()
  const { stableHeight, isAvailable, expandCount } = useTelegramWebApp()
  const { isLoading, error } = useSessionLoader()
  const setRouteError = useMapStore((s) => s.actions.setRouteError)

  // Expose stable viewport height as a CSS custom property so shells can
  // use `height: var(--tma-vh)` instead of 100vh (avoids Telegram toolbar overlap).
  // With viewport-fit=cover, window.innerHeight includes safe-area insets while
  // viewportStableHeight from TMA SDK may not — take the larger of the two.
  useEffect(() => {
    const vh = Math.max(stableHeight, window.innerHeight)
    document.documentElement.style.setProperty('--tma-vh', `${vh}px`)
  }, [stableHeight])

  // Surface session load error via the existing route error banner
  useEffect(() => {
    if (error) setRouteError(error)
  }, [error, setRouteError])

  if (isLoading) {
    return (
      <div className={`${styles.root} ${styles.sessionLoading}`}>
        <span className={styles.sessionLoadingText}>Загрузка маршрута…</span>
      </div>
    )
  }

  return (
    <div className={`${styles.root} ${isAvailable ? styles.tma : ''}`}>
      <AppShell key={expandCount} />
    </div>
  )
}
