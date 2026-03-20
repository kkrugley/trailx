import { useRef } from 'react'
import { usePlatform } from '../../hooks/usePlatform'
import { MapView } from '../MapView/MapView'
import type { MapViewHandle } from '../MapView/MapView'
import { Sidebar } from '../Sidebar/Sidebar'
import { MobileHeader } from '../MobileHeader/MobileHeader'
import { BottomSheet } from './BottomSheet'
import { MapControls } from '../MapControls/MapControls'
import { ElevationBar } from '../ElevationBar/ElevationBar'
import styles from './AppShell.module.css'

export function AppShell() {
  const { isMobile, isTMA } = usePlatform()
  const isDesktop = !isMobile && !isTMA
  const mapRef = useRef<MapViewHandle>(null)

  if (isDesktop) {
    return (
      <div className={styles.desktopGrid}>
        {/* Map fills the entire grid as background layer */}
        <div className={styles.mapLayer}>
          <MapView ref={mapRef} />
        </div>

        {/* Left column: sidebar */}
        <div className={styles.sidebarCol}>
          <Sidebar />
        </div>

        {/* Center column: empty space (map shows through) */}
        <div className={styles.centerCol} />

        {/* Right column: map controls */}
        <div className={styles.controlsCol}>
          <MapControls mapRef={mapRef} />
        </div>

        {/* Bottom row: elevation bar */}
        <div className={styles.elevationRow}>
          <ElevationBar />
        </div>
      </div>
    )
  }

  // Mobile / TMA layout
  return (
    <div className={styles.mobileGrid}>
      {/* Row 1: top search bar */}
      <div className={styles.mobileTopRow}>
        <MobileHeader />
      </div>

      {/* Row 2: spacer (grid gap) */}
      <div />

      {/* Row 3: full-screen map */}
      <div className={styles.mobileMapRow}>
        <MapView ref={mapRef} />
        <div className={styles.mobileControls}>
          <MapControls mapRef={mapRef} />
        </div>
      </div>

      {/* Row 4: bottom sheet */}
      <div className={styles.mobileBottomRow}>
        <BottomSheet />
      </div>
    </div>
  )
}
