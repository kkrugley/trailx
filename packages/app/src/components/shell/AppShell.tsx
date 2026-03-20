import { useRef } from 'react'
import { usePlatform } from '../../hooks/usePlatform'
import { useMapStore } from '../../store/useMapStore'
import { MapView } from '../MapView/MapView'
import type { MapViewHandle } from '../MapView/MapView'
import { Sidebar } from '../Sidebar/Sidebar'
import { MobileHeader } from '../MobileHeader/MobileHeader'
import { SearchBar } from '../Header/SearchBar'
import { ExportPanel } from '../ExportPanel/ExportPanel'
import { POICard } from '../POICard/POICard'
import { BottomSheet } from './BottomSheet'
import { MapControls } from '../MapControls/MapControls'
import { ElevationBar } from '../ElevationBar/ElevationBar'
import styles from './AppShell.module.css'

export function AppShell() {
  const { isMobile, isTMA } = usePlatform()
  const isDesktop = !isMobile && !isTMA
  const mapRef = useRef<MapViewHandle>(null)

  const isExportOpen = useMapStore((s) => s.isExportOpen)
  const selectedPOI = useMapStore((s) => s.selectedPOI)
  const { setSelectedPOI } = useMapStore((s) => s.actions)

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
        <div className={styles.centerCol}>
          {isExportOpen && (
            <div className={styles.searchOverlay}>
              <ExportPanel />
            </div>
          )}
        </div>

        {/* Right column: map controls */}
        <div className={styles.controlsCol}>
          <MapControls mapRef={mapRef} />
        </div>

        {/* Bottom row: elevation bar */}
        <div className={styles.elevationRow}>
          <ElevationBar />
        </div>

        <POICard poi={selectedPOI} onClose={() => setSelectedPOI(null)} />
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

      {isExportOpen && (
        <div className={styles.mobileExportOverlay}>
          <ExportPanel />
        </div>
      )}

      <POICard poi={selectedPOI} onClose={() => setSelectedPOI(null)} />
    </div>
  )
}
