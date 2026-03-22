import { useCallback, useRef, useState } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { useMapStore, type AppSettings } from '../../store/useMapStore'
import { ProfileTabs } from '../ProfileTabs/ProfileTabs'
import { WaypointInputList } from '../WaypointInputList/WaypointInputList'
import { ErrorMessage } from '../ErrorMessage/ErrorMessage'
import { FilterBar } from '../FilterBar/FilterBar'
import { PoweredBy } from '../PoweredBy/PoweredBy'
import { ElevationChart } from '../ElevationBar/ElevationChart'
import { SurfaceChart } from '../ElevationBar/SurfaceChart'
import { RoadClassChart } from '../ElevationBar/RoadClassChart'
import { Chip } from '../ui/Chip'
import styles from './BottomSheet.module.css'

// ── Accordion ────────────────────────────────────────────────────────────────

interface AccordionProps {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}

function Accordion({ title, open, onToggle, children }: AccordionProps) {
  return (
    <div className={styles.accordion}>
      <button className={styles.accordionHeader} onClick={onToggle}>
        <span className={styles.accordionTitle}>{title}</span>
        {open ? <CaretUp size={13} weight="bold" /> : <CaretDown size={13} weight="bold" />}
      </button>
      {open && <div className={styles.accordionBody}>{children}</div>}
    </div>
  )
}

// ── POI buffer slider ─────────────────────────────────────────────────────────

function PoiBufferSlider() {
  const poiBuffer = useMapStore((s) => s.appSettings.poiBuffer)
  const { updateSettings } = useMapStore((s) => s.actions)

  return (
    <div className={styles.sliderRow}>
      <div className={styles.sliderHeader}>
        <span className={styles.sliderLabel}>Радиус поиска</span>
        <span className={styles.sliderValue}>
          {poiBuffer >= 1000
            ? `${(poiBuffer / 1000).toFixed(poiBuffer % 1000 === 0 ? 0 : 1)} км`
            : `${poiBuffer} м`}
        </span>
      </div>
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
    </div>
  )
}

// ── Elevation section ─────────────────────────────────────────────────────────

type ViewMode = 'elevation' | 'surface' | 'roadclass'

const VIEW_LABELS: Record<ViewMode, string> = {
  elevation: 'Набор высоты',
  surface: 'Покрытие',
  roadclass: 'Тип дороги',
}

function formatElevation(m: number): string {
  return `${Math.round(m)} м`
}

function computeGain(elevation: number[]): number {
  return elevation.reduce(
    (acc, v, i) => (i > 0 && v > elevation[i - 1] ? acc + (v - elevation[i - 1]) : acc),
    0,
  )
}

function ElevationSection() {
  const routeResult = useMapStore((s) => s.routeResult)
  const { setHoveredRoutePosition } = useMapStore((s) => s.actions)
  const [view, setView] = useState<ViewMode>('elevation')

  const handleHoverFraction = useCallback((fraction: number | null) => {
    if (fraction === null || !routeResult) { setHoveredRoutePosition(null); return }
    const coords = routeResult.geometry.coordinates
    const idx = Math.round(fraction * (coords.length - 1))
    const [lng, lat] = coords[Math.max(0, Math.min(idx, coords.length - 1))]
    setHoveredRoutePosition([lng, lat])
  }, [routeResult, setHoveredRoutePosition])

  if (!routeResult || routeResult.elevation.length === 0) {
    return <p className={styles.noData}>Постройте маршрут для отображения данных</p>
  }

  const { elevation, surface, roadClass } = routeResult
  const minElev = Math.min(...elevation)
  const maxElev = Math.max(...elevation)
  const gain = computeGain(elevation)

  return (
    <div className={styles.elevSection}>
      {/* View tabs */}
      <div className={styles.viewTabs}>
        {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
          <button
            key={v}
            className={`${styles.viewTab} ${view === v ? styles.viewTabActive : ''}`}
            onClick={() => setView(v)}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {/* Chips for elevation view */}
      {view === 'elevation' && (
        <div className={styles.elevChips}>
          <Chip label={`+${formatElevation(gain)}`} title="Набор высоты" />
          <Chip label={formatElevation(minElev)} title="Мин. высота" />
          <Chip label={formatElevation(maxElev)} title="Макс. высота" />
        </div>
      )}

      {/* Chart */}
      <div className={styles.elevChart}>
        {view === 'elevation' && (
          <ElevationChart elevation={elevation} distance={routeResult.distance} height={90} onHoverFraction={handleHoverFraction} />
        )}
        {view === 'surface' && surface && surface.length > 0 && (
          <SurfaceChart surface={surface} distance={routeResult.distance} onHoverFraction={handleHoverFraction} />
        )}
        {view === 'surface' && (!surface || surface.length === 0) && (
          <p className={styles.noData}>Нет данных о покрытии</p>
        )}
        {view === 'roadclass' && roadClass && roadClass.length > 0 && (
          <RoadClassChart roadClass={roadClass} distance={routeResult.distance} onHoverFraction={handleHoverFraction} />
        )}
        {view === 'roadclass' && (!roadClass || roadClass.length === 0) && (
          <p className={styles.noData}>Нет данных о типе дороги</p>
        )}
      </div>
    </div>
  )
}

// ── BottomSheet ───────────────────────────────────────────────────────────────

const COLLAPSED_H = () => {
  const root = getComputedStyle(document.documentElement)
  const handle = parseFloat(root.getPropertyValue('--bottom-sheet-handle-height')) || 28
  const peek   = parseFloat(root.getPropertyValue('--bottom-sheet-peek')) || 52
  return handle + peek
}
const EXPANDED_H = () => window.innerHeight * 0.6

export function BottomSheet() {
  const [expanded, setExpanded] = useState(false)
  const [elevOpen, setElevOpen] = useState(false)
  const [poiOpen, setPoiOpen] = useState(false)

  const sheetRef   = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    startY: number
    startH: number
    lastY: number
    lastT: number
    active: boolean
  } | null>(null)

  // Запускаем перетаскивание только если:
  // - шит закрыт (любой тач), или
  // - шит открыт и контент прокручен в самый верх
  const canStartDrag = useCallback((target: EventTarget | null) => {
    if (!expanded) return true
    const content = contentRef.current
    if (content && content.scrollTop > 2) return false
    // на ручке — всегда можно
    if (target instanceof Element && target.closest('[data-handle]')) return true
    // на открытом контенте — только если скролл = 0
    return content ? content.scrollTop <= 2 : true
  }, [expanded])

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!canStartDrag(e.target)) return
    const sheet = sheetRef.current
    if (!sheet) return
    const currentH = sheet.getBoundingClientRect().height
    drag.current = {
      startY: e.touches[0].clientY,
      startH: currentH,
      lastY:  e.touches[0].clientY,
      lastT:  Date.now(),
      active: true,
    }
    // отключаем CSS-переход на время перетаскивания
    sheet.style.transition = 'none'
  }, [canStartDrag])

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const d = drag.current
    const sheet = sheetRef.current
    if (!d || !d.active || !sheet) return

    const y     = e.touches[0].clientY
    const delta = d.startY - y          // вверх → положительное
    const newH  = Math.max(COLLAPSED_H(), Math.min(EXPANDED_H(), d.startH + delta))

    sheet.style.height = `${newH}px`
    d.lastY = y
    d.lastT = Date.now()
  }, [])

  const onTouchEnd = useCallback(() => {
    const d = drag.current
    const sheet = sheetRef.current
    if (!d || !d.active || !sheet) return
    d.active = false

    // Измеряем высоту ДО сброса инлайн-стиля — это реальная позиция после свайпа
    const currentH = sheet.getBoundingClientRect().height

    // восстанавливаем CSS-переход и сбрасываем инлайн-высоту
    sheet.style.transition = ''
    sheet.style.height = ''

    const collH = COLLAPSED_H()
    const expH  = EXPANDED_H()
    const midH  = (collH + expH) / 2

    // скорость px/ms (вверх — положительная)
    const dt = Date.now() - d.lastT
    const velocity = dt > 0 ? (d.startY - d.lastY) / dt : 0

    let shouldExpand: boolean
    if (Math.abs(velocity) > 0.3) {
      shouldExpand = velocity > 0   // быстрый свайп вверх → открыть
    } else {
      shouldExpand = currentH > midH
    }

    setExpanded(shouldExpand)
    drag.current = null
  }, [])

  return (
    <div
      ref={sheetRef}
      className={`${styles.sheet} ${expanded ? styles.expanded : styles.collapsed}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button
        className={styles.handle}
        data-handle="true"
        onClick={() => setExpanded((prev) => !prev)}
        aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
        aria-expanded={expanded}
      >
        <span className={styles.handleBar} />
      </button>

      {!expanded && (
        <div className={styles.peek} onClick={() => setExpanded(true)}>
          <p className={styles.hint}>Потяните вверх для управления маршрутом</p>
        </div>
      )}

      {expanded && (
        <div ref={contentRef} className={styles.content}>
          <div className={styles.profileRow}>
            <ProfileTabs />
          </div>
          <div className={styles.waypointWrapper}>
            <WaypointInputList />
          </div>
          <div className={styles.waypointWrapper}>
            <ErrorMessage />
          </div>

          <Accordion
            title="Высоты и покрытие"
            open={elevOpen}
            onToggle={() => setElevOpen((v) => !v)}
          >
            <ElevationSection />
          </Accordion>

          <Accordion
            title="Фильтр точек POI"
            open={poiOpen}
            onToggle={() => setPoiOpen((v) => !v)}
          >
            <FilterBar />
            <PoiBufferSlider />
          </Accordion>

          <div className={styles.footerAttrib}>
            <PoweredBy />
          </div>
        </div>
      )}
    </div>
  )
}
