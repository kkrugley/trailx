import { useEffect, useRef } from 'react'
import {
  Drop, Wrench, House, Bicycle, Tent, ForkKnife, CastleTurret, Binoculars, MapPin,
} from '@phosphor-icons/react'
import { POI_CATEGORIES, POI_LABELS, POI_COLORS } from '@trailx/shared'
import type { POICategory } from '@trailx/shared'
import { useMapStore, type AppSettings } from '../../store/useMapStore'
import { fmtDist } from '../../utils/units'
import styles from './POIFilter.module.css'

const CATEGORY_ICONS: Record<POICategory, React.ReactNode> = {
  drinking_water: <Drop size={14} weight="fill" />,
  bicycle_repair: <Wrench size={14} weight="fill" />,
  shelter:        <House size={14} weight="fill" />,
  bicycle_shop:   <Bicycle size={14} weight="fill" />,
  camp_site:      <Tent size={14} weight="fill" />,
  food:           <ForkKnife size={14} weight="fill" />,
  historic:       <CastleTurret size={14} weight="fill" />,
  viewpoint:      <Binoculars size={14} weight="fill" />,
  custom:         <MapPin size={14} weight="fill" />,
}

interface POIFilterProps {
  onClose: () => void
}

export function POIFilter({ onClose }: POIFilterProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const activeCategories = useMapStore((s) => s.activeCategories)
  const poiBuffer = useMapStore((s) => s.appSettings.poiBuffer)
  const unit = useMapStore((s) => s.appSettings.distanceUnit)
  const { toggleCategory, setActiveCategories, updateSettings } = useMapStore((s) => s.actions)

  const allOn = activeCategories.length === POI_CATEGORIES.length
  const allOff = activeCategories.length === 0

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', keyHandler)
    return () => document.removeEventListener('keydown', keyHandler)
  }, [onClose])

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={panelRef} className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>Фильтр POI</span>
          <button
            className={`${styles.toggleAll} ${allOn ? styles.toggleAllActive : ''}`}
            onClick={() => setActiveCategories(allOn ? [] : [...POI_CATEGORIES])}
          >
            {allOn ? 'Скрыть все' : allOff ? 'Показать все' : 'Выбрать все'}
          </button>
        </div>

        <div className={styles.grid}>
          {POI_CATEGORIES.map((cat: POICategory) => {
            const active = activeCategories.includes(cat)
            return (
              <button
                key={cat}
                className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                style={{ '--chip-color': POI_COLORS[cat] } as React.CSSProperties}
                onClick={() => toggleCategory(cat)}
              >
                <span className={styles.icon} style={{ color: POI_COLORS[cat] }}>
                  {CATEGORY_ICONS[cat]}
                </span>
                <span className={styles.label}>{POI_LABELS[cat]}</span>
              </button>
            )
          })}
        </div>

        <div className={styles.bufferSection}>
          <span className={styles.bufferLabel}>Радиус поиска</span>
          <div className={styles.sliderRow}>
            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={poiBuffer}
              onChange={(e) => {
                let v = Number(e.target.value)
                if (v > 1000) v = Math.round(v / 500) * 500
                updateSettings({ poiBuffer: v } as Partial<AppSettings>)
              }}
              className={styles.slider}
            />
            <span className={styles.sliderValue}>
              {fmtDist(poiBuffer, unit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
