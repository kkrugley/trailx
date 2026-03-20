import { useEffect } from 'react'
import { AppShell } from './components/shell/AppShell'
import { usePlatform } from './hooks/usePlatform'
import styles from './App.module.css'

export function App() {
  const platform = usePlatform()

  useEffect(() => {
    console.log('[usePlatform]', platform)
  }, [platform])

  return (
    <div className={styles.root}>
      <AppShell />
    </div>
  )
}
