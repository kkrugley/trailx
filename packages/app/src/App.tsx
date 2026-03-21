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
  useEffect(() => {
    document.documentElement.style.setProperty('--tma-vh', `${stableHeight}px`)
  }, [stableHeight])

  return (
    <div className={`${styles.root} ${isAvailable ? styles.tma : ''}`}>
      <AppShell />
    </div>
  )
}
