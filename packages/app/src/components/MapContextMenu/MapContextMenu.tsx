import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Compass, FlagBanner, FlagPennant, MapPin, PlusCircle, Copy, PencilSimpleLine } from '@phosphor-icons/react'
import styles from './MapContextMenu.module.css'

export interface MapContextMenuProps {
  lat: number
  lng: number
  x: number
  y: number
  onClose: () => void
  onSetStart: () => void
  onAddIntermediate: () => void
  onSetEnd: () => void
  onAddPoi: () => void
}

export function MapContextMenu({
  lat, lng, x, y,
  onClose,
  onSetStart,
  onAddIntermediate,
  onSetEnd,
  onAddPoi,
}: MapContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return
      onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handleOutside)
      document.addEventListener('touchstart', handleOutside)
      document.addEventListener('keydown', handleKey)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Adjust position so menu stays within viewport on all 4 edges
  const MARGIN = 8
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const { offsetWidth: w, offsetHeight: h } = el
    setPos({
      left: Math.min(Math.max(x, MARGIN), window.innerWidth - w - MARGIN),
      top: Math.min(Math.max(y, MARGIN), window.innerHeight - h - MARGIN),
    })
  }, [x, y])

  const style: React.CSSProperties = { left: pos.left, top: pos.top }

  function copyCoords() {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
    onClose()
  }

  function openOSM() {
    window.open(
      `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
      '_blank',
      'noreferrer',
    )
    onClose()
  }

  return (
    <div ref={menuRef} className={styles.menu} style={style} onContextMenu={(e) => e.preventDefault()}>
      {/* Координаты */}
      <div className={styles.coordRow}>
        <Compass size={13} weight="fill" className={styles.coordIcon} />
        <span className={styles.coordText}>
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
      </div>

      <div className={styles.divider} />

      {/* Маршрутные действия */}
      <button className={styles.item} onClick={() => { onSetStart(); onClose() }}>
        <FlagBanner size={15} weight="fill" className={styles.iconStart} />
        Установить начало
      </button>
      <button className={styles.item} onClick={() => { onAddIntermediate(); onClose() }}>
        <PlusCircle size={15} weight="fill" className={styles.iconMid} />
        Добавить промежуточную
      </button>
      <button className={styles.item} onClick={() => { onSetEnd(); onClose() }}>
        <FlagPennant size={15} weight="fill" className={styles.iconEnd} />
        Установить конец
      </button>

      <div className={styles.divider} />

      {/* Метка */}
      <button className={styles.item} onClick={() => { onAddPoi(); onClose() }}>
        <MapPin size={15} weight="fill" className={styles.iconPoi} />
        Добавить метку
      </button>

      <div className={styles.divider} />

      {/* Вспомогательные */}
      <button className={styles.item} onClick={copyCoords}>
        <Copy size={15} className={styles.iconUtil} />
        Копировать координаты
      </button>
      <button className={styles.item} onClick={openOSM}>
        <PencilSimpleLine size={15} className={styles.iconUtil} />
        Открыть в OSM
      </button>
    </div>
  )
}
