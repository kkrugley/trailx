import { useState } from 'react'
import { RoutePanel } from '../RoutePanel/RoutePanel'
import styles from './BottomSheet.module.css'

export function BottomSheet() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`${styles.sheet} ${expanded ? styles.expanded : styles.collapsed}`}>
      <button
        className={styles.handle}
        onClick={() => setExpanded((prev) => !prev)}
        aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
        aria-expanded={expanded}
      >
        <span className={styles.handleBar} />
      </button>
      <div className={styles.content}>
        <RoutePanel />
      </div>
    </div>
  )
}
