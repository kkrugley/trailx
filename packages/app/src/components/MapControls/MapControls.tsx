import type { RefObject } from 'react'
import { Plus, Minus, Crosshair } from '@phosphor-icons/react'
import type { MapViewHandle } from '../MapView/MapView'
import styles from './MapControls.module.css'

interface MapControlsProps {
  mapRef: RefObject<MapViewHandle | null>
}

export function MapControls({ mapRef }: MapControlsProps) {
  const zoomIn = () => mapRef.current?.getMap()?.zoomIn()
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
    <div className={styles.controls}>
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

      {/* Locate — separate pill */}
      <button className={styles.locateBtn} onClick={locate} aria-label="My location">
        <Crosshair size={17} weight="bold" />
      </button>
    </div>
  )
}
