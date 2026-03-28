import { useEffect, useRef, useState, useCallback, type RefObject } from 'react'
import { useMapStore } from '../../store/useMapStore'
import { useTmaDebug } from '../../hooks/useTmaDebug'
import { usePlatform } from '../../hooks/usePlatform'
import type { MapViewHandle } from '../MapView/MapView'
import styles from './DebugPanel.module.css'

// Brest, Belarus → Kobryn, Belarus
const TEST_ROUTE = [
  { lat: 52.093693, lng: 23.684978, label: 'Брест, Беларусь' },
  { lat: 52.213612, lng: 24.362652, label: 'Кобрин, Беларусь' },
]

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <span className={styles.statKey}>{label}</span>
      <span className={styles.statVal}>{String(value)}</span>
    </>
  )
}

function Section({
  title,
  sectionKey,
  open,
  onToggle,
  headerExtra,
  children,
}: {
  title: string
  sectionKey: string
  open: boolean
  onToggle: (key: string) => void
  headerExtra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={styles.section}>
      <div className={styles.accordionHeader} onClick={() => onToggle(sectionKey)}>
        <div className={styles.sectionTitle}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {headerExtra}
          <span className={`${styles.accordionChevron} ${open ? styles.accordionChevronOpen : ''}`}>▼</span>
        </div>
      </div>
      {open && <div className={styles.accordionBody}>{children}</div>}
    </div>
  )
}

function readViewportValues() {
  const cs = getComputedStyle(document.documentElement)
  return {
    tmaVh: cs.getPropertyValue('--tma-vh').trim() || 'N/A',
    tgVsh: cs.getPropertyValue('--tg-viewport-stable-height').trim() || 'N/A',
  }
}

interface DebugPanelProps {
  onClose: () => void
  mapRef: RefObject<MapViewHandle | null>
}

export function DebugPanel({ onClose, mapRef }: DebugPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const isMobile = window.innerWidth < 768

  const waypoints      = useMapStore((s) => s.waypoints)
  const routeResult    = useMapStore((s) => s.routeResult)
  const isRouting      = useMapStore((s) => s.isRouting)
  const pois           = useMapStore((s) => s.pois)
  const allPois        = useMapStore((s) => s.allPois)
  const standalonePois = useMapStore((s) => s.standalonePois)
  const activeCategories = useMapStore((s) => s.activeCategories)
  const poiBuffer      = useMapStore((s) => s.appSettings.poiBuffer)
  const profile        = useMapStore((s) => s.profile)
  const { updateWaypoint, clearRoute } = useMapStore((s) => s.actions)

  const { isTMA, isMobile: isMobileHook } = usePlatform()
  const { logs: tmaLogs, refresh: refreshLogs } = useTmaDebug()

  const [vpValues, setVpValues] = useState(readViewportValues)
  const [desktopMaxHeight, setDesktopMaxHeight] = useState<number | undefined>(undefined)

  // On desktop, clamp max-height so panel doesn't overflow the top of the viewport
  useEffect(() => {
    if (isMobile) return
    const measure = () => {
      if (!panelRef.current) return
      const rect = panelRef.current.getBoundingClientRect()
      // panel is anchored at bottom=0 of anchor, so its bottom ≈ anchor bottom
      // available space above = rect.bottom - 8px margin
      const available = Math.min(rect.bottom - 8, window.innerHeight * 0.7)
      setDesktopMaxHeight(Math.max(available, 120))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isMobile])
  const [mapState, setMapState] = useState<Record<string, string>>({})
  const [copiedStore, setCopiedStore] = useState(false)
  const [copiedLogs, setCopiedLogs] = useState(false)

  const [sections, setSections] = useState<Record<string, boolean>>({
    platform: false,
    viewport: false,
    route: false,
    poi: false,
    map: false,
    store: false,
    tools: false,
    log: false,
  })

  const toggle = useCallback((key: string) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Read MapLibre state
  const readMapState = useCallback(() => {
    try {
      const map = mapRef.current?.getMap()
      if (!map) {
        setMapState({ zoom: 'N/A', center: 'N/A', bearing: 'N/A', pitch: 'N/A', style: 'N/A', sources: 'N/A', layers: 'N/A' })
        return
      }
      const center = map.getCenter()
      const styleObj = map.getStyle()
      setMapState({
        zoom: map.getZoom().toFixed(1),
        center: `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`,
        bearing: map.getBearing().toFixed(0) + '°',
        pitch: map.getPitch().toFixed(0) + '°',
        style: styleObj?.name ?? (typeof styleObj?.sprite === 'string' ? styleObj.sprite : 'unknown'),
        sources: String(Object.keys(styleObj?.sources ?? {}).length),
        layers: String(styleObj?.layers?.length ?? 0),
      })
    } catch {
      setMapState({ zoom: 'N/A', center: 'N/A', bearing: 'N/A', pitch: 'N/A', style: 'N/A', sources: 'N/A', layers: 'N/A' })
    }
  }, [mapRef])

  useEffect(() => {
    readMapState()
  }, [readMapState])

  // Refresh viewport values on resize
  useEffect(() => {
    const onResize = () => setVpValues(readViewportValues())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Auto-scroll log to bottom
  useEffect(() => {
    if (sections.log) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [tmaLogs, sections.log])

  // Close on outside click / Escape
  useEffect(() => {
    if (isMobile) return // backdrop handles this on mobile
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose, isMobile])

  // Escape on mobile too
  useEffect(() => {
    if (!isMobile) return
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', keyHandler)
    return () => document.removeEventListener('keydown', keyHandler)
  }, [onClose, isMobile])

  function loadTestRoute() {
    clearRoute()
    const fresh = useMapStore.getState()
    const [start, end] = fresh.waypoints
    updateWaypoint(start.id, TEST_ROUTE[0].lat, TEST_ROUTE[0].lng, TEST_ROUTE[0].label)
    updateWaypoint(end.id,   TEST_ROUTE[1].lat, TEST_ROUTE[1].lng, TEST_ROUTE[1].label)
    onClose()
  }

  function clearLocalStorage() {
    if (window.confirm('Clear localStorage and reload?')) {
      localStorage.clear()
      location.reload()
    }
  }

  function copyStore() {
    try {
      const state = useMapStore.getState()
      const snapshot = {
        ...state,
        routeResult: state.routeResult
          ? { ...state.routeResult, geometry: '[truncated]' }
          : null,
        actions: undefined,
      }
      navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2)).then(() => {
        setCopiedStore(true)
        setTimeout(() => setCopiedStore(false), 1500)
      })
    } catch { /* ignore */ }
  }

  function copyLogs() {
    const text = tmaLogs
      .map((log) =>
        `${log.timestamp} | ${log.event} | ${log.innerWidth}×${log.innerHeight} | expanded: ${String(log.isExpanded)}`
      )
      .join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLogs(true)
      setTimeout(() => setCopiedLogs(false), 1500)
    })
  }

  // Platform section values
  const webApp = window.Telegram?.WebApp
  const surface = isTMA ? 'TMA' : isMobileHook ? 'Mobile Web' : 'Desktop'
  const sdkVersion = webApp ? `v${webApp.version}` : 'N/A'
  const initDataLen = webApp?.initData ? `${webApp.initData.length} chars` : 'none'
  const platformStr = webApp?.platform ?? navigator.userAgent.slice(0, 60)
  const colorScheme = webApp?.colorScheme ?? 'system'

  // Route section values
  const resolvedCount = waypoints.filter((p) => !isNaN(p.lat)).length
  const routeStatus = isRouting ? 'routing...' : routeResult ? 'ready' : 'idle'
  const routeDist = routeResult ? (routeResult.distance / 1000).toFixed(1) + ' km' : '—'
  const routeTime = routeResult ? Math.round(routeResult.duration / 60) + ' min' : '—'
  const elevStr = routeResult?.elevation?.length
    ? (() => {
        const elev = routeResult.elevation
        const ascent = elev.reduce((acc, v, i) => i > 0 && v > elev[i-1] ? acc + (v - elev[i-1]) : acc, 0)
        const descent = elev.reduce((acc, v, i) => i > 0 && v < elev[i-1] ? acc + (elev[i-1] - v) : acc, 0)
        return `↑${Math.round(ascent)}m ↓${Math.round(descent)}m`
      })()
    : '—'

  // POI section
  const categoriesStr = activeCategories.length === 0 ? 'all' : activeCategories.join(', ')

  // Viewport refresh
  function refreshViewport() {
    setVpValues(readViewportValues())
    refreshLogs()
  }

  const vpRefreshBtn = (
    <button
      onClick={(e) => { e.stopPropagation(); refreshViewport() }}
      title="Refresh"
      className={styles.iconBtn}
    >
      ↺
    </button>
  )

  const mapRefreshBtn = (
    <button
      onClick={(e) => { e.stopPropagation(); readMapState() }}
      title="Refresh"
      className={styles.iconBtn}
    >
      ↺
    </button>
  )

  const content = (
    <div
      ref={panelRef}
      className={isMobile ? styles.panelTop : styles.panel}
      style={!isMobile && desktopMaxHeight ? { maxHeight: desktopMaxHeight } : undefined}
    >
      <div className={styles.header}>
        Debug Menu
        {isMobile && (
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        )}
      </div>

      {/* 1. Platform */}
      <Section title="Platform" sectionKey="platform" open={sections.platform} onToggle={toggle}>
        <div className={styles.statGrid}>
          <Row label="Surface" value={surface} />
          <Row label="TMA SDK" value={sdkVersion} />
          <Row label="initData" value={initDataLen} />
          <Row label="Expanded" value={webApp?.isExpanded !== undefined ? String(webApp.isExpanded) : 'N/A'} />
          <Row label="Fullscreen" value={typeof webApp?.isFullscreen === 'boolean' ? String(webApp.isFullscreen) : 'N/A'} />
          <Row label="Platform" value={platformStr} />
          <Row label="Color scheme" value={colorScheme} />
        </div>
      </Section>

      {/* 2. Viewport */}
      <Section title="Viewport" sectionKey="viewport" open={sections.viewport} onToggle={toggle} headerExtra={vpRefreshBtn}>
        <div className={styles.statGrid}>
          <Row label="Window" value={`${window.innerWidth}×${window.innerHeight}`} />
          <Row label="--tma-vh" value={vpValues.tmaVh} />
          <Row label="--tg-vsh" value={vpValues.tgVsh} />
          <Row label="Root" value={(() => { const r = document.getElementById('root'); return r ? `${r.offsetWidth}×${r.offsetHeight}` : 'N/A' })()} />
          <Row label="DPR" value={window.devicePixelRatio} />
        </div>
      </Section>

      {/* 3. Route State */}
      <Section title="Route State" sectionKey="route" open={sections.route} onToggle={toggle}>
        <div className={styles.statGrid}>
          <Row label="Profile" value={profile} />
          <Row label="Waypoints" value={`${resolvedCount} / ${waypoints.length}`} />
          <Row label="Status" value={routeStatus} />
          <Row label="Distance" value={routeDist} />
          <Row label="Duration" value={routeTime} />
          <Row label="Elevation" value={elevStr} />
        </div>
      </Section>

      {/* 4. POI State */}
      <Section title="POI State" sectionKey="poi" open={sections.poi} onToggle={toggle}>
        <div className={styles.statGrid}>
          <Row label="Total loaded" value={allPois.length} />
          <Row label="Visible" value={pois.length} />
          <Row label="Standalone" value={standalonePois.length} />
          <Row label="Categories" value={categoriesStr} />
          <Row label="Buffer" value={`${poiBuffer}m`} />
        </div>
      </Section>

      {/* 5. Map State */}
      <Section title="Map State" sectionKey="map" open={sections.map} onToggle={toggle} headerExtra={mapRefreshBtn}>
        <div className={styles.statGrid}>
          <Row label="Zoom" value={mapState.zoom ?? 'N/A'} />
          <Row label="Center" value={mapState.center ?? 'N/A'} />
          <Row label="Bearing" value={mapState.bearing ?? 'N/A'} />
          <Row label="Pitch" value={mapState.pitch ?? 'N/A'} />
          <Row label="Style" value={mapState.style ?? 'N/A'} />
          <Row label="Sources" value={mapState.sources ?? 'N/A'} />
          <Row label="Layers" value={mapState.layers ?? 'N/A'} />
        </div>
      </Section>

      {/* 6. Store Snapshot */}
      <Section title="Store" sectionKey="store" open={sections.store} onToggle={toggle}>
        <button className={styles.actionBtn} onClick={copyStore}>
          {copiedStore ? '✓ Copied' : 'Copy Store'}
          <span className={styles.actionHint}>JSON to clipboard</span>
        </button>
      </Section>

      {/* 7. Tools */}
      <Section title="Tools" sectionKey="tools" open={sections.tools} onToggle={toggle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <button className={styles.actionBtn} onClick={loadTestRoute}>
            Тестовый маршрут
            <span className={styles.actionHint}>Брест → Кобрин</span>
          </button>
          <button className={styles.actionBtn} onClick={copyLogs}>
            {copiedLogs ? '✓ Copied' : 'Copy logs'}
            <span className={styles.actionHint}>viewport events</span>
          </button>
          <button className={styles.actionBtn} onClick={() => location.reload()}>
            Force reload
          </button>
          <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={clearLocalStorage}>
            Clear localStorage
            <span className={styles.actionHint}>+ reload</span>
          </button>
        </div>
      </Section>

      {/* 8. Event Log */}
      <Section title="Event Log" sectionKey="log" open={sections.log} onToggle={toggle}>
        <div className={styles.logContainer}>
          {tmaLogs.length === 0 && <span style={{ opacity: 0.4, fontSize: '0.5625rem' }}>No events yet</span>}
          {tmaLogs.map((log, i) => (
            <div key={i} className={styles.logEntry}>
              {log.timestamp} | {log.event} | {log.innerWidth}×{log.innerHeight} | expanded: {String(log.isExpanded)}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </Section>
    </div>
  )

  if (isMobile) {
    return (
      <>
        <div className={styles.backdrop} onClick={onClose} />
        {content}
      </>
    )
  }

  return content
}
