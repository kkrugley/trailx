import { useRef, useState } from 'react'
import { Funnel } from '@phosphor-icons/react'
import { usePlatform } from '../../hooks/usePlatform'
import { useMapStore } from '../../store/useMapStore'
import { MapView } from '../MapView/MapView'
import type { MapViewHandle } from '../MapView/MapView'
import { Sidebar } from '../Sidebar/Sidebar'
import { MobileHeader } from '../MobileHeader/MobileHeader'
import { ExportPanel } from '../ExportPanel/ExportPanel'
import { POICard } from '../POICard/POICard'
import { POIFilter } from '../POIFilter/POIFilter'
import { BottomSheet } from './BottomSheet'
import { MapControls } from '../MapControls/MapControls'
import { ElevationBar } from '../ElevationBar/ElevationBar'
import { KeyboardDismissBar } from '../KeyboardDismissBar/KeyboardDismissBar'
import styles from './AppShell.module.css'

export function AppShell() {
  const { isMobile, isTMA } = usePlatform()
  console.log('[TMA-DEBUG] AppShell:', { isMobile, isTMA, isDesktop: !isMobile && !isTMA })
  const isDesktop = !isMobile && !isTMA
  const mapRef = useRef<MapViewHandle>(null)
  const [filterOpen, setFilterOpen] = useState(false)

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

        {/* Center column: transparent (map shows through) */}
        <div className={styles.centerCol} />

        {/* Right column: map controls */}
        <div className={styles.controlsCol}>
          <MapControls mapRef={mapRef} />
        </div>

        {/* Bottom row: elevation bar */}
        <div className={styles.elevationRow}>
          <ElevationBar />
        </div>

        <POICard poi={selectedPOI} onClose={() => setSelectedPOI(null)} />

        {/* POI filter — fixed bottom-right */}
        <button
          className={`${styles.filterBtn} ${filterOpen ? styles.filterBtnActive : ''}`}
          onClick={() => setFilterOpen((v) => !v)}
          aria-label="Фильтр POI"
          title="Фильтр POI"
        >
          <Funnel size={16} weight={filterOpen ? 'fill' : 'regular'} />
          <span>Фильтр</span>
        </button>
        {filterOpen && <POIFilter onClose={() => setFilterOpen(false)} />}
      </div>
    )
  }

  // Mobile / TMA layout
  return (
    <div className={styles.mobileGrid}>
      {/* Row 1: full-screen map */}
      <div className={styles.mobileMapRow}>
        <MapView ref={mapRef} />
        <div className={styles.mobileControls}>
          <MapControls mapRef={mapRef} />
        </div>
      </div>

      {/* BottomSheet — absolute over map, sits above bottom bar */}
      <BottomSheet />

      {/* Row 2: persistent bottom bar with route info / hint */}
      <div className={styles.mobileBottomBar}>
        <MobileHeader />
      </div>

      {isExportOpen && (
        <div className={styles.mobileExportOverlay}>
          <ExportPanel />
        </div>
      )}

      <POICard poi={selectedPOI} onClose={() => setSelectedPOI(null)} />

      <KeyboardDismissBar />
    </div>
  )
}
