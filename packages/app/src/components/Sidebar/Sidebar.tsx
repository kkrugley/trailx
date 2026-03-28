import { useState } from 'react'
import { List, X, WarningCircle } from '@phosphor-icons/react'
import { useMapStore } from '../../store/useMapStore'
import { ProfileTabs } from '../ProfileTabs/ProfileTabs'
import { WaypointInputList } from '../WaypointInputList/WaypointInputList'
import { RouteResults } from '../RouteResults/RouteResults'
import { ExportPanel } from '../ExportPanel/ExportPanel'
import { ErrorMessage } from '../ErrorMessage/ErrorMessage'
import { PoweredBy } from '../PoweredBy/PoweredBy'
import styles from './Sidebar.module.css'

function POISearchErrorBanner() {
  const poiSearchError = useMapStore((s) => s.poiSearchError)
  const { setPOISearchError } = useMapStore((s) => s.actions)

  if (!poiSearchError) return null

  return (
    <div className={styles.poiError} role="alert">
      <WarningCircle size={14} weight="fill" className={styles.poiErrorIcon} />
      <span className={styles.poiErrorText}>{poiSearchError}</span>
      <button
        className={styles.poiErrorDismiss}
        onClick={() => setPOISearchError(null)}
        aria-label="Dismiss POI error"
      >
        ×
      </button>
    </div>
  )
}

export function Sidebar() {
  const [open, setOpen] = useState(true)
  const routeResult = useMapStore((s) => s.routeResult)

  if (!open) {
    return (
      <button
        className={styles.hamburger}
        onClick={() => setOpen(true)}
        aria-label="Open sidebar"
      >
        <List size={22} weight="regular" />
      </button>
    )
  }

  return (
    <div className={styles.card}>
      {/* Brand header with topographic texture */}
      <div className={styles.brandHeader}>
        <div className={styles.brandTopoPattern} aria-hidden />
        <span className={styles.brandName}>TrailX</span>
        <span className={styles.brandTagline}>Route Planner</span>
        <button
          className={styles.closeBtn}
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
        >
          <X size={15} weight="regular" />
        </button>
      </div>

      <div className={styles.scroll}>
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Transport</p>
          <ProfileTabs />
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Waypoints</p>
          <WaypointInputList />
        </div>

        <ErrorMessage />

        <POISearchErrorBanner />

        {routeResult && (
          <div className={styles.section}>
            <RouteResults result={routeResult} />
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.exportDivider} />
          <div className={styles.exportWrap}>
            <ExportPanel />
          </div>
          <PoweredBy />
        </div>
      </div>
    </div>
  )
}
