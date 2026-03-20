import { useState } from 'react'
import { useMapStore } from '../../store/useMapStore'
import { ProfileTabs } from '../ProfileTabs/ProfileTabs'
import { WaypointInputList } from '../WaypointInputList/WaypointInputList'
import { RouteResults } from '../RouteResults/RouteResults'
import { ErrorMessage } from '../ErrorMessage/ErrorMessage'
import { CollapsedFooter } from '../CollapsedFooter/CollapsedFooter'
import { PoweredBy } from '../PoweredBy/PoweredBy'
import styles from './BottomSheet.module.css'

export function BottomSheet() {
  const [expanded, setExpanded] = useState(false)
  const routeResult = useMapStore((s) => s.routeResult)

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

      {/* Collapsed peek: show route stats or hint */}
      {!expanded && (
        <div className={styles.peek} onClick={() => setExpanded(true)}>
          {routeResult ? (
            <CollapsedFooter result={routeResult} />
          ) : (
            <p className={styles.hint}>Tap to manage waypoints</p>
          )}
        </div>
      )}

      {/* Expanded: full content */}
      {expanded && (
        <div className={styles.content}>
          <div className={styles.profileRow}>
            <ProfileTabs />
          </div>
          <WaypointInputList />
          <ErrorMessage />
          {routeResult && <RouteResults result={routeResult} />}
          <div className={styles.footerAttrib}>
            <PoweredBy />
          </div>
        </div>
      )}
    </div>
  )
}
