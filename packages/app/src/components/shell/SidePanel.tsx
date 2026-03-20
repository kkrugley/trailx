import { RoutePanel } from '../RoutePanel/RoutePanel'
import styles from './SidePanel.module.css'

export function SidePanel() {
  return (
    <aside className={styles.panel} aria-label="Route panel">
      <div className={styles.inner}>
        <RoutePanel />
      </div>
    </aside>
  )
}
