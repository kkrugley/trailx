import { RoutePanel } from '../RoutePanel/RoutePanel'
import { FilterBar } from '../FilterBar/FilterBar'
import { ExportPanel } from '../ExportPanel/ExportPanel'
import styles from './SidePanel.module.css'

export function SidePanel() {
  return (
    <aside className={styles.panel} aria-label="Route panel">
      <div className={styles.inner}>
        <RoutePanel />
      </div>
      <FilterBar />
      <ExportPanel />
    </aside>
  )
}
