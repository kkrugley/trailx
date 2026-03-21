import { useEffect, useRef } from 'react'
import { Compass, FlagBanner, FlagPennant, PlusCircle, Copy, PencilSimpleLine } from '@phosphor-icons/react'
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
}

export function MapContextMenu({
  lat, lng, x, y,
  onClose,
  onSetStart,
  onAddIntermediate,
  onSetEnd,
}: MapContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return
      onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('keydown', handleKey)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Adjust position so menu doesn't overflow viewport
  const style: React.CSSProperties = { left: x, top: y }

  function copyCoords() {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
    onClose()
  }

  function openOSM() {
    window.open(
      `https://www.openstreetmap.org/edit?lat=${lat}&lon=${lng}&zoom=17`,
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

      {/* Вспомогательные */}
      <button className={styles.item} onClick={copyCoords}>
        <Copy size={15} className={styles.iconUtil} />
        Копировать координаты
      </button>
      <button className={styles.item} onClick={openOSM}>
        <PencilSimpleLine size={15} className={styles.iconUtil} />
        Редактировать в OSM
      </button>
    </div>
  )
}
