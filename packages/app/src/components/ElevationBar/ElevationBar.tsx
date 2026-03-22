import { useCallback, useState } from 'react'
import { CaretUp, CaretDown, X, ArrowsOutSimple, ArrowsInSimple } from '@phosphor-icons/react'
import { useMapStore } from '../../store/useMapStore'
import { fmtElev } from '../../utils/units'
import { Chip } from '../ui/Chip'
import { ElevationChart } from './ElevationChart'
import { SurfaceChart } from './SurfaceChart'
import { RoadClassChart } from './RoadClassChart'
import styles from './ElevationBar.module.css'

type ElevMode = 'compact' | 'expanded' | 'closed'
type ViewMode = 'elevation' | 'surface' | 'roadclass'

const VIEW_LABELS: Record<ViewMode, string> = {
  elevation: 'Набор высоты',
  surface:   'Покрытие',
  roadclass: 'Тип дороги',
}

function computeGain(elevation: number[]): number {
  return elevation.reduce(
    (acc, v, i) => (i > 0 && v > elevation[i - 1] ? acc + (v - elevation[i - 1]) : acc),
    0,
  )
}

export function ElevationBar() {
  const routeResult = useMapStore((s) => s.routeResult)
  const unit = useMapStore((s) => s.appSettings.distanceUnit)
  const { setHoveredRoutePosition } = useMapStore((s) => s.actions)
  const [mode, setMode] = useState<ElevMode>('expanded')
  const [view, setView] = useState<ViewMode>('elevation')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [wide, setWide] = useState(false)

  const handleHoverFraction = useCallback((fraction: number | null) => {
    if (fraction === null || !routeResult) {
      setHoveredRoutePosition(null)
      return
    }
    const coords = routeResult.geometry.coordinates
    const idx = Math.round(fraction * (coords.length - 1))
    const [lng, lat] = coords[Math.max(0, Math.min(idx, coords.length - 1))]
    setHoveredRoutePosition([lng, lat])
  }, [routeResult, setHoveredRoutePosition])

  if (!routeResult || routeResult.elevation.length === 0) return null

  const { elevation, surface, roadClass } = routeResult
  const minElev = Math.min(...elevation)
  const maxElev = Math.max(...elevation)
  const gain = computeGain(elevation)

  if (mode === 'closed') {
    return (
      <button className={styles.reopenBtn} onClick={() => setMode('compact')}>
        <CaretUp size={14} />
      </button>
    )
  }

  const isExpanded = mode === 'expanded'

  return (
    <div className={`${styles.bar} ${isExpanded ? styles.expanded : ''} ${wide ? styles.wide : ''}`}>
      <div className={styles.header}>
        {/* View selector dropdown */}
        <div className={styles.viewSelector}>
          <button
            className={styles.viewBtn}
            onClick={() => setDropdownOpen((v) => !v)}
          >
            <span>{VIEW_LABELS[view]}</span>
            <CaretDown size={10} style={{ opacity: 0.6 }} />
          </button>
          {dropdownOpen && (
            <div className={styles.dropdown}>
              {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
                <button
                  key={v}
                  className={`${styles.dropdownItem} ${view === v ? styles.dropdownItemActive : ''}`}
                  onClick={() => { setView(v); setDropdownOpen(false) }}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chips (elevation only) */}
        {view === 'elevation' && (
          <div className={styles.chips}>
            <Chip label={`+${fmtElev(gain, unit)}`} title="Набор высоты" />
            <Chip label={`${fmtElev(minElev, unit)}`} title="Мин. высота" />
            <Chip label={`${fmtElev(maxElev, unit)}`} title="Макс. высота" />
          </div>
        )}

        {view !== 'elevation' && <div className={styles.chips} />}

        <div className={styles.controls}>
          {/* Wide toggle */}
          <button
            className={styles.controlBtn}
            onClick={() => setWide((v) => !v)}
          >
            {wide ? <ArrowsInSimple size={14} /> : <ArrowsOutSimple size={14} />}
          </button>
          {/* Expand/collapse */}
          <button
            className={styles.controlBtn}
            onClick={() => setMode(isExpanded ? 'compact' : 'expanded')}
          >
            {isExpanded ? <CaretDown size={14} /> : <CaretUp size={14} />}
          </button>
          {/* Close */}
          <button
            className={styles.controlBtn}
            onClick={() => setMode('closed')}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.chart}>
          {view === 'elevation' && (
            <ElevationChart elevation={elevation} distance={routeResult.distance} height={100} unit={unit} onHoverFraction={handleHoverFraction} />
          )}
          {view === 'surface' && surface && surface.length > 0 && (
            <SurfaceChart surface={surface} distance={routeResult.distance} unit={unit} onHoverFraction={handleHoverFraction} />
          )}
          {view === 'surface' && (!surface || surface.length === 0) && (
            <div className={styles.noData}>Нет данных о покрытии</div>
          )}
          {view === 'roadclass' && roadClass && roadClass.length > 0 && (
            <RoadClassChart roadClass={roadClass} distance={routeResult.distance} unit={unit} onHoverFraction={handleHoverFraction} />
          )}
          {view === 'roadclass' && (!roadClass || roadClass.length === 0) && (
            <div className={styles.noData}>Нет данных о типе дороги</div>
          )}
        </div>
      )}
    </div>
  )
}
