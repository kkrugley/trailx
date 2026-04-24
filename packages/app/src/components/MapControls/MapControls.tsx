import { useState, useRef, type RefObject } from 'react'
import { Plus, Minus, Crosshair, GearSix, Stack, Question, Bug, Toolbox, User } from '@phosphor-icons/react'
import type { MapViewHandle } from '../MapView/MapView'
import { AppSettingsPanel } from '../AppSettings/AppSettings'
import { MapLayers } from '../MapLayers/MapLayers'
import { AppInfo } from '../AppInfo/AppInfo'
import { DebugPanel } from '../DebugPanel/DebugPanel'
import { ToolsPanel } from '../ToolsPanel/ToolsPanel'
import { AccountPanel } from '../AccountPanel'
import { useMapStore } from '../../store/useMapStore'
import { useT } from '../../i18n/useT'
import styles from './MapControls.module.css'

interface MapControlsProps {
  mapRef: RefObject<MapViewHandle | null>
}

export function MapControls({ mapRef }: MapControlsProps) {
  const debugPopoverClass = styles.popoverUp
  const [infoOpen, setInfoOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const authUser = useMapStore((s) => s.authUser)
  const [layersOpen, setLayersOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const t = useT()
  const zoomIn  = () => mapRef.current?.getMap()?.zoomIn()
  const zoomOut = () => mapRef.current?.getMap()?.zoomOut()

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        mapRef.current?.getMap()?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
        })
      },
      () => {},
    )
  }

  return (
    <div ref={containerRef} className={styles.controls}>
      {/* Info button */}
      <div className={styles.popoverAnchor}>
        <button
          className={`${styles.iconBtn} ${infoOpen ? styles.iconBtnActive : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { setInfoOpen((v) => !v); setSettingsOpen(false); setLayersOpen(false); setDebugOpen(false) }}
          aria-label={t.mapControls.infoAriaLabel}
        >
          <Question size={17} weight={infoOpen ? 'fill' : 'regular'} />
        </button>
        {infoOpen && (
          <div className={styles.popover}>
            <AppInfo onClose={() => setInfoOpen(false)} />
          </div>
        )}
      </div>

  {/* Account button */}
  <div className={styles.popoverAnchor}>
    <button
      className={`${styles.iconBtn} ${accountOpen ? styles.iconBtnActive : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => { setAccountOpen((v) => !v); setInfoOpen(false); setSettingsOpen(false); setLayersOpen(false); setDebugOpen(false) }}
      aria-label="Account"
    >
      <User size={17} weight={authUser ? 'fill' : 'regular'} />
    </button>
    {accountOpen && (
      <div className={styles.popoverWide}>
        <AccountPanel onClose={() => setAccountOpen(false)} />
      </div>
    )}
  </div>

      {/* Settings button */}
      <div className={styles.popoverAnchor}>
        <button
          className={`${styles.iconBtn} ${settingsOpen ? styles.iconBtnActive : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { setSettingsOpen((v) => !v); setLayersOpen(false); setInfoOpen(false); setDebugOpen(false) }}
          aria-label={t.mapControls.settingsAriaLabel}
        >
          <GearSix size={17} weight={settingsOpen ? 'fill' : 'regular'} />
        </button>
        {settingsOpen && (
          <div className={styles.popover}>
            <AppSettingsPanel onClose={() => setSettingsOpen(false)} />
          </div>
        )}
      </div>

      {/* Map layers button */}
      <div className={styles.popoverAnchor}>
        <button
          className={`${styles.iconBtn} ${layersOpen ? styles.iconBtnActive : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { setLayersOpen((v) => !v); setSettingsOpen(false); setInfoOpen(false); setToolsOpen(false); setDebugOpen(false) }}
          aria-label={t.mapControls.layersAriaLabel}
        >
          <Stack size={17} weight={layersOpen ? 'fill' : 'regular'} />
        </button>
        {layersOpen && (
          <div className={styles.popover}>
            <MapLayers onClose={() => setLayersOpen(false)} />
          </div>
        )}
      </div>

      {/* Tools button */}
      <div className={styles.popoverAnchor}>
        <button
          className={`${styles.iconBtn} ${toolsOpen ? styles.iconBtnActive : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { setToolsOpen((v) => !v); setSettingsOpen(false); setLayersOpen(false); setInfoOpen(false); setDebugOpen(false) }}
          aria-label={t.mapControls.toolsAriaLabel}
        >
          <Toolbox size={17} weight={toolsOpen ? 'fill' : 'regular'} />
        </button>
        {toolsOpen && (
          <div className={styles.popover}>
            <ToolsPanel onClose={() => setToolsOpen(false)} mapRef={mapRef} />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Zoom — stacked pill */}
      <div className={styles.zoomGroup}>
        <button className={styles.btn} onClick={zoomIn} aria-label="Zoom in">
          <Plus size={17} weight="bold" />
        </button>
        <div className={styles.zoomDivider} />
        <button className={styles.btn} onClick={zoomOut} aria-label="Zoom out">
          <Minus size={17} weight="bold" />
        </button>
      </div>

      {/* Locate */}
      <button className={styles.locateBtn} onClick={locate} aria-label="My location">
        <Crosshair size={17} weight="bold" />
      </button>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Debug button */}
      <div className={styles.popoverAnchor}>
        <button
          className={`${styles.iconBtn} ${debugOpen ? styles.iconBtnActive : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { setDebugOpen((v) => !v); setSettingsOpen(false); setLayersOpen(false); setInfoOpen(false) }}
          aria-label="Debug"
        >
          <Bug size={17} weight={debugOpen ? 'fill' : 'regular'} />
        </button>
        {debugOpen && (
          <div className={debugPopoverClass}>
            <DebugPanel onClose={() => setDebugOpen(false)} mapRef={mapRef} />
          </div>
        )}
      </div>
    </div>
  )
}
