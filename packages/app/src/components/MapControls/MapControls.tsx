import { useState, useRef, useEffect, type RefObject } from 'react'
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

type ActivePanel = 'info' | 'account' | 'settings' | 'layers' | 'tools' | 'debug' | null

interface MapControlsProps {
  mapRef: RefObject<MapViewHandle | null>
}

export function MapControls({ mapRef }: MapControlsProps) {
  const debugPopoverClass = styles.popoverUp
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const authUser = useMapStore((s) => s.authUser)
  const containerRef = useRef<HTMLDivElement>(null)

  const t = useT()

  const toggle = (panel: NonNullable<ActivePanel>) =>
    setActivePanel((cur) => (cur === panel ? null : panel))

  const close = () => setActivePanel(null)

  // Close active panel on click outside the controls widget
  useEffect(() => {
    if (!activePanel) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePanel(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activePanel])

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
          className={`${styles.iconBtn} ${activePanel === 'info' ? styles.iconBtnActive : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => toggle('info')}
          aria-label={t.mapControls.infoAriaLabel}
        >
          <Question size={17} weight={activePanel === 'info' ? 'fill' : 'regular'} />
        </button>
        {activePanel === 'info' && (
          <div className={styles.popover}>
            <AppInfo onClose={close} />
          </div>
        )}
      </div>

      {/* Account button */}
      <div className={styles.popoverAnchor}>
        <button
          className={`${styles.iconBtn} ${activePanel === 'account' ? styles.iconBtnActive : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => toggle('account')}
          aria-label="Account"
        >
          <User size={17} weight={authUser ? 'fill' : 'regular'} />
        </button>
        {activePanel === 'account' && (
          <div className={styles.popoverWide}>
            <AccountPanel onClose={close} />
          </div>
        )}
      </div>

      {/* Settings button */}
      <div className={styles.popoverAnchor}>
        <button
          className={`${styles.iconBtn} ${activePanel === 'settings' ? styles.iconBtnActive : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => toggle('settings')}
          aria-label={t.mapControls.settingsAriaLabel}
        >
          <GearSix size={17} weight={activePanel === 'settings' ? 'fill' : 'regular'} />
        </button>
        {activePanel === 'settings' && (
          <div className={styles.popover}>
            <AppSettingsPanel onClose={close} />
          </div>
        )}
      </div>

      {/* Map layers button */}
      <div className={styles.popoverAnchor}>
        <button
          className={`${styles.iconBtn} ${activePanel === 'layers' ? styles.iconBtnActive : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => toggle('layers')}
          aria-label={t.mapControls.layersAriaLabel}
        >
          <Stack size={17} weight={activePanel === 'layers' ? 'fill' : 'regular'} />
        </button>
        {activePanel === 'layers' && (
          <div className={styles.popover}>
            <MapLayers onClose={close} />
          </div>
        )}
      </div>

      {/* Tools button */}
      <div className={styles.popoverAnchor}>
        <button
          className={`${styles.iconBtn} ${activePanel === 'tools' ? styles.iconBtnActive : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => toggle('tools')}
          aria-label={t.mapControls.toolsAriaLabel}
        >
          <Toolbox size={17} weight={activePanel === 'tools' ? 'fill' : 'regular'} />
        </button>
        {activePanel === 'tools' && (
          <div className={styles.popover}>
            <ToolsPanel onClose={close} mapRef={mapRef} />
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
          className={`${styles.iconBtn} ${activePanel === 'debug' ? styles.iconBtnActive : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => toggle('debug')}
          aria-label="Debug"
        >
          <Bug size={17} weight={activePanel === 'debug' ? 'fill' : 'regular'} />
        </button>
        {activePanel === 'debug' && (
          <div className={debugPopoverClass}>
            <DebugPanel onClose={close} mapRef={mapRef} />
          </div>
        )}
      </div>
    </div>
  )
}
