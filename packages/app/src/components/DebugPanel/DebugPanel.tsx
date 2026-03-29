import { useEffect, useRef, useState, useCallback, type RefObject } from 'react'
import { useMapStore } from '../../store/useMapStore'
import { useTmaDebug } from '../../hooks/useTmaDebug'
import { usePlatform } from '../../hooks/usePlatform'
import type { MapViewHandle } from '../MapView/MapView'
import styles from './DebugPanel.module.css'

const LAND_ZONES: Array<{ lat: number; lng: number; name: string; country: string }> = [
  { lat: 52.52, lng: 13.40, name: 'Berlin', country: 'DE' },
  { lat: 51.51, lng: -0.13, name: 'London', country: 'UK' },
  { lat: 48.85, lng: 2.35, name: 'Paris', country: 'FR' },
  { lat: 40.42, lng: -3.70, name: 'Madrid', country: 'ES' },
  { lat: 41.39, lng: 2.17, name: 'Barcelona', country: 'ES' },
  { lat: 52.37, lng: 4.90, name: 'Amsterdam', country: 'NL' },
  { lat: 50.08, lng: 8.24, name: 'Frankfurt', country: 'DE' },
  { lat: 48.14, lng: 11.58, name: 'Munich', country: 'DE' },
  { lat: 50.45, lng: 30.52, name: 'Kyiv', country: 'UA' },
  { lat: 53.90, lng: 27.57, name: 'Minsk', country: 'BY' },
  { lat: 59.33, lng: 18.07, name: 'Stockholm', country: 'SE' },
  { lat: 55.68, lng: 12.57, name: 'Copenhagen', country: 'DK' },
  { lat: 60.17, lng: 24.94, name: 'Helsinki', country: 'FI' },
  { lat: 59.91, lng: 10.75, name: 'Oslo', country: 'NO' },
  { lat: 57.71, lng: 11.97, name: 'Gothenburg', country: 'SE' },
  { lat: 45.46, lng: 9.19, name: 'Milan', country: 'IT' },
  { lat: 41.90, lng: 12.50, name: 'Rome', country: 'IT' },
  { lat: 45.42, lng: -75.69, name: 'Ottawa', country: 'CA' },
  { lat: 43.65, lng: -79.38, name: 'Toronto', country: 'CA' },
  { lat: 45.50, lng: -73.57, name: 'Montreal', country: 'CA' },
  { lat: 37.77, lng: -122.42, name: 'San Francisco', country: 'US' },
  { lat: 37.34, lng: -121.89, name: 'San Jose', country: 'US' },
  { lat: 37.87, lng: -122.27, name: 'Oakland', country: 'US' },
  { lat: 47.61, lng: -122.33, name: 'Seattle', country: 'US' },
  { lat: 45.52, lng: -122.68, name: 'Portland', country: 'US' },
  { lat: 39.95, lng: -75.17, name: 'Philadelphia', country: 'US' },
  { lat: 42.36, lng: -71.06, name: 'Boston', country: 'US' },
  { lat: 39.29, lng: -76.61, name: 'Baltimore', country: 'US' },
  { lat: 38.91, lng: -77.04, name: 'Washington DC', country: 'US' },
  { lat: 33.75, lng: -84.39, name: 'Atlanta', country: 'US' },
  { lat: 36.17, lng: -86.78, name: 'Nashville', country: 'US' },
  { lat: 35.23, lng: -80.84, name: 'Charlotte', country: 'US' },
  { lat: 35.47, lng: -97.52, name: 'Oklahoma City', country: 'US' },
  { lat: 32.78, lng: -96.80, name: 'Dallas', country: 'US' },
  { lat: 29.76, lng: -95.37, name: 'Houston', country: 'US' },
  { lat: 30.33, lng: -81.66, name: 'Jacksonville', country: 'US' },
  { lat: 25.76, lng: -80.19, name: 'Miami', country: 'US' },
  { lat: 36.17, lng: -115.14, name: 'Las Vegas', country: 'US' },
  { lat: 33.45, lng: -112.07, name: 'Phoenix', country: 'US' },
  { lat: 34.05, lng: -118.24, name: 'Los Angeles', country: 'US' },
  { lat: 32.72, lng: -117.16, name: 'San Diego', country: 'US' },
  { lat: 19.43, lng: -99.13, name: 'Mexico City', country: 'MX' },
  { lat: 20.66, lng: -103.35, name: 'Guadalajara', country: 'MX' },
  { lat: -23.55, lng: -46.63, name: 'Sao Paulo', country: 'BR' },
  { lat: -22.91, lng: -43.17, name: 'Rio de Janeiro', country: 'BR' },
  { lat: -34.60, lng: -58.38, name: 'Buenos Aires', country: 'AR' },
  { lat: -33.45, lng: -70.67, name: 'Santiago', country: 'CL' },
  { lat: -33.87, lng: 151.21, name: 'Sydney', country: 'AU' },
  { lat: -37.81, lng: 144.96, name: 'Melbourne', country: 'AU' },
  { lat: -31.95, lng: 115.86, name: 'Perth', country: 'AU' },
  { lat: -36.85, lng: 174.76, name: 'Auckland', country: 'NZ' },
  { lat: -41.29, lng: 174.78, name: 'Wellington', country: 'NZ' },
  { lat: 35.69, lng: 139.69, name: 'Tokyo', country: 'JP' },
  { lat: 37.57, lng: 126.98, name: 'Seoul', country: 'KR' },
  { lat: 22.32, lng: 114.17, name: 'Hong Kong', country: 'HK' },
  { lat: 31.23, lng: 121.47, name: 'Shanghai', country: 'CN' },
  { lat: 39.91, lng: 116.39, name: 'Beijing', country: 'CN' },
  { lat: 22.28, lng: 114.16, name: 'Shenzhen', country: 'CN' },
  { lat: 1.35, lng: 103.82, name: 'Singapore', country: 'SG' },
  { lat: 13.76, lng: 100.50, name: 'Bangkok', country: 'TH' },
  { lat: 10.82, lng: 106.63, name: 'Ho Chi Minh City', country: 'VN' },
  { lat: 21.03, lng: 105.85, name: 'Hanoi', country: 'VN' },
  { lat: 25.03, lng: 121.57, name: 'Taipei', country: 'TW' },
  { lat: 35.18, lng: 136.90, name: 'Nagoya', country: 'JP' },
  { lat: 34.69, lng: 135.50, name: 'Osaka', country: 'JP' },
  { lat: 33.31, lng: 44.37, name: 'Baghdad', country: 'IQ' },
  { lat: 30.06, lng: 31.24, name: 'Cairo', country: 'EG' },
  { lat: 36.80, lng: 10.17, name: 'Tunis', country: 'TN' },
  { lat: 33.89, lng: 35.50, name: 'Beirut', country: 'LB' },
  { lat: 32.09, lng: 34.78, name: 'Tel Aviv', country: 'IL' },
  { lat: 29.36, lng: 47.98, name: 'Kuwait City', country: 'KW' },
  { lat: 25.28, lng: 51.53, name: 'Doha', country: 'QA' },
  { lat: 24.45, lng: 54.37, name: 'Abu Dhabi', country: 'AE' },
  { lat: 25.20, lng: 55.27, name: 'Dubai', country: 'AE' },
  { lat: 28.61, lng: 77.21, name: 'New Delhi', country: 'IN' },
  { lat: 19.08, lng: 72.88, name: 'Mumbai', country: 'IN' },
  { lat: 12.97, lng: 77.59, name: 'Bangalore', country: 'IN' },
  { lat: 28.63, lng: 77.22, name: 'Delhi', country: 'IN' },
  { lat: 23.13, lng: 72.54, name: 'Ahmedabad', country: 'IN' },
  { lat: 23.81, lng: 90.41, name: 'Dhaka', country: 'BD' },
  { lat: 6.52, lng: 3.38, name: 'Lagos', country: 'NG' },
  { lat: -4.04, lng: 39.67, name: 'Mombasa', country: 'KE' },
  { lat: -26.20, lng: 28.05, name: 'Johannesburg', country: 'ZA' },
  { lat: -33.92, lng: 18.42, name: 'Cape Town', country: 'ZA' },
  { lat: 43.86, lng: 18.41, name: 'Sarajevo', country: 'BA' },
  { lat: 41.33, lng: 19.82, name: 'Tirana', country: 'AL' },
  { lat: 42.00, lng: 21.43, name: 'Skopje', country: 'MK' },
  { lat: 43.85, lng: 18.35, name: 'Sarajevo', country: 'BA' },
  { lat: 44.79, lng: 20.47, name: 'Belgrade', country: 'RS' },
  { lat: 41.01, lng: 28.96, name: 'Istanbul', country: 'TR' },
  { lat: 37.98, lng: 23.73, name: 'Athens', country: 'GR' },
  { lat: 35.90, lng: 14.51, name: 'Valletta', country: 'MT' },
  { lat: 38.72, lng: -9.14, name: 'Lisbon', country: 'PT' },
  { lat: 41.39, lng: -8.65, name: 'Porto', country: 'PT' },
  { lat: 47.50, lng: 19.04, name: 'Budapest', country: 'HU' },
  { lat: 50.08, lng: 14.42, name: 'Prague', country: 'CZ' },
  { lat: 52.23, lng: 21.01, name: 'Warsaw', country: 'PL' },
  { lat: 51.11, lng: 17.04, name: 'Wroclaw', country: 'PL' },
  { lat: 50.06, lng: 19.94, name: 'Krakow', country: 'PL' },
  { lat: 46.05, lng: 14.51, name: 'Ljubljana', country: 'SI' },
  { lat: 45.81, lng: 15.98, name: 'Zagreb', country: 'HR' },
  { lat: 43.51, lng: 16.44, name: 'Split', country: 'HR' },
  { lat: 56.95, lng: 24.11, name: 'Riga', country: 'LV' },
  { lat: 54.69, lng: 25.28, name: 'Vilnius', country: 'LT' },
  { lat: 58.59, lng: 25.02, name: 'Tartu', country: 'EE' },
  { lat: 46.77, lng: 23.59, name: 'Cluj-Napoca', country: 'RO' },
  { lat: 44.44, lng: 26.10, name: 'Bucharest', country: 'RO' },
  { lat: 42.70, lng: 23.32, name: 'Sofia', country: 'BG' },
  { lat: 43.21, lng: 27.92, name: 'Varna', country: 'BG' },
  { lat: 40.63, lng: 22.94, name: 'Thessaloniki', country: 'GR' },
  { lat: 53.35, lng: -6.26, name: 'Dublin', country: 'IE' },
  { lat: 54.60, lng: -5.93, name: 'Belfast', country: 'UK' },
  { lat: 55.86, lng: -4.25, name: 'Glasgow', country: 'UK' },
  { lat: 53.48, lng: -2.24, name: 'Manchester', country: 'UK' },
  { lat: 52.49, lng: -1.89, name: 'Birmingham', country: 'UK' },
  { lat: 50.82, lng: -0.14, name: 'Brighton', country: 'UK' },
  { lat: 50.38, lng: -4.13, name: 'Plymouth', country: 'UK' },
  { lat: 51.88, lng: -8.47, name: 'Cork', country: 'IE' },
]

function degToRad(deg: number): number {
  return deg * Math.PI / 180
}

function radToDeg(rad: number): number {
  return rad * 180 / Math.PI
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = degToRad(lat2 - lat1)
  const dLng = degToRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function destinationPoint(lat: number, lng: number, bearing: number, distance: number): { lat: number; lng: number } {
  const R = 6371000
  const d = distance / R
  const brng = degToRad(bearing)
  const φ1 = degToRad(lat)
  const λ1 = degToRad(lng)
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(brng))
  const λ2 = λ1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2))
  return {
    lat: radToDeg(φ2),
    lng: radToDeg(λ2),
  }
}

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function generateRandomRoute(): Array<{ lat: number; lng: number; label: string }> {
  const targetDistance = 5000
  const distanceTolerance = 2000
  
  let attempts = 0
  while (attempts < 50) {
    const zone = LAND_ZONES[Math.floor(Math.random() * LAND_ZONES.length)]
    const bearing = Math.random() * 360
    const point1: { lat: number; lng: number } = {
      lat: zone.lat + randomInRange(-0.01, 0.01),
      lng: zone.lng + randomInRange(-0.01, 0.01),
    }
    const point2 = destinationPoint(point1.lat, point1.lng, bearing, targetDistance)
    const actualDistance = haversineDistance(point1.lat, point1.lng, point2.lat, point2.lng)
    
    if (actualDistance >= targetDistance - distanceTolerance && actualDistance <= targetDistance + distanceTolerance) {
      const distKm = (actualDistance / 1000).toFixed(1)
      return [
        { lat: point1.lat, lng: point1.lng, label: `Point A (${distKm}km)` },
        { lat: point2.lat, lng: point2.lng, label: `Point B` },
      ]
    }
    attempts++
  }
  
  const zone = LAND_ZONES[Math.floor(Math.random() * LAND_ZONES.length)]
  const bearing = 90
  const point1: { lat: number; lng: number } = {
    lat: zone.lat,
    lng: zone.lng,
  }
  const point2 = destinationPoint(point1.lat, point1.lng, bearing, targetDistance)
  return [
    { lat: point1.lat, lng: point1.lng, label: 'Point A' },
    { lat: point2.lat, lng: point2.lng, label: 'Point B' },
  ]
}

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
    const route = generateRandomRoute()
    updateWaypoint(start.id, route[0].lat, route[0].lng, route[0].label)
    updateWaypoint(end.id,   route[1].lat, route[1].lng, route[1].label)
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
          <Row label="Fullscreen" value={webApp && 'isFullscreen' in webApp && typeof (webApp as unknown as Record<string, unknown>).isFullscreen === 'boolean' ? String((webApp as unknown as Record<string, unknown>).isFullscreen) : 'N/A'} />
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
            <span className={styles.actionHint}>Random route</span>
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
