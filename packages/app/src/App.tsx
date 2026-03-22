import { useEffect } from 'react'
import { AppShell } from './components/shell/AppShell'
import { useTelegramWebApp } from './hooks/useTelegramWebApp'
import { useRouteSync } from './hooks/useRouteSync'
import styles from './App.module.css'

export function App() {
  useRouteSync()
  const { stableHeight, isAvailable } = useTelegramWebApp()

  // Expose stable viewport height as a CSS custom property so shells can
  // use `height: var(--tma-vh)` instead of 100vh (avoids Telegram toolbar overlap).
  // With viewport-fit=cover, window.innerHeight includes safe-area insets while
  // viewportStableHeight from TMA SDK may not — take the larger of the two.
  useEffect(() => {
    const vh = Math.max(stableHeight, window.innerHeight)
    document.documentElement.style.setProperty('--tma-vh', `${vh}px`)
  }, [stableHeight])

  return (
    <div className={`${styles.root} ${isAvailable ? styles.tma : ''}`}>
      <AppShell />
    </div>
  )
}
