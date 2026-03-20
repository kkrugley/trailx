import { X, WarningCircle } from '@phosphor-icons/react'
import { useMapStore } from '../../store/useMapStore'
import styles from './ErrorMessage.module.css'

export function ErrorMessage() {
  const routeError = useMapStore((s) => s.routeError)
  const setRouteError = useMapStore((s) => s.actions.setRouteError)

  if (!routeError) return null

  return (
    <div className={styles.banner} role="alert">
      <WarningCircle size={16} weight="fill" className={styles.icon} />
      <span className={styles.text}>{routeError}</span>
      <button
        className={styles.dismiss}
        onClick={() => setRouteError(null)}
        aria-label="Dismiss error"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  )
}
