import { useEffect, useRef } from 'react'
import { useMapStore } from '../../store/useMapStore'
import { useTmaDebug } from '../../hooks/useTmaDebug'
import styles from './DebugPanel.module.css'

interface DebugPanelProps {
  onClose: () => void
}

// Brest, Belarus → Kobryn, Belarus
const TEST_ROUTE = [
  { lat: 52.093693, lng: 23.684978, label: 'Брест, Беларусь' },
  { lat: 52.213612, lng: 24.362652, label: 'Кобрин, Беларусь' },
]

export function DebugPanel({ onClose }: DebugPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const waypoints  = useMapStore((s) => s.waypoints)
  const routeResult = useMapStore((s) => s.routeResult)
  const isRouting  = useMapStore((s) => s.isRouting)
  const pois       = useMapStore((s) => s.pois)
  const allPois    = useMapStore((s) => s.allPois)
  const profile    = useMapStore((s) => s.profile)
  const { updateWaypoint, clearRoute } = useMapStore((s) => s.actions)
  const tmaLogs = useTmaDebug()

  useEffect(() => {
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
  }, [onClose])

  function loadTestRoute() {
    clearRoute()
    // After clearRoute, store resets to 2 empty waypoints — update them by id
    // We need to read fresh state, so use store directly
    const fresh = useMapStore.getState()
    const [start, end] = fresh.waypoints
    updateWaypoint(start.id, TEST_ROUTE[0].lat, TEST_ROUTE[0].lng, TEST_ROUTE[0].label)
    updateWaypoint(end.id,   TEST_ROUTE[1].lat, TEST_ROUTE[1].lng, TEST_ROUTE[1].label)
    onClose()
  }

  const resolvedCount = waypoints.filter((p) => !isNaN(p.lat)).length
  const routeDist = routeResult
    ? (routeResult.distance / 1000).toFixed(1) + ' km'
    : '—'
  const routeTime = routeResult
    ? Math.round(routeResult.duration / 60) + ' min'
    : '—'

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.header}>Debug</div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Состояние</div>
        <div className={styles.statGrid}>
          <span className={styles.statKey}>Профиль</span>
          <span className={styles.statVal}>{profile}</span>

          <span className={styles.statKey}>Точки</span>
          <span className={styles.statVal}>{resolvedCount} / {waypoints.length}</span>

          <span className={styles.statKey}>Маршрут</span>
          <span className={styles.statVal}>{isRouting ? 'загрузка…' : (routeResult ? 'готов' : '—')}</span>

          <span className={styles.statKey}>Расстояние</span>
          <span className={styles.statVal}>{routeDist}</span>

          <span className={styles.statKey}>Время</span>
          <span className={styles.statVal}>{routeTime}</span>

          <span className={styles.statKey}>POI всего</span>
          <span className={styles.statVal}>{allPois.length}</span>

          <span className={styles.statKey}>POI видимых</span>
          <span className={styles.statVal}>{pois.length}</span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Инструменты</div>
        <button className={styles.actionBtn} onClick={loadTestRoute}>
          Тестовый маршрут
          <span className={styles.actionHint}>Брест → Кобрин</span>
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>TMA Viewport</div>
        <div style={{ maxHeight: '200px', overflow: 'auto', fontSize: '0.625rem', fontFamily: 'monospace' }}>
          {tmaLogs.length === 0 && <span style={{ opacity: 0.4 }}>Collecting...</span>}
          {tmaLogs.map((log, i) => (
            <div key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', padding: '2px 0' }}>
              <div><b>{log.timestamp}</b> {log.event}</div>
              <div>win: {log.innerWidth}×{log.innerHeight} expanded: {String(log.isExpanded)}</div>
              <div>vh: {log.viewportHeight} svh: {log.viewportStableHeight}</div>
              <div>--tma-vh: {log.tmaVh} root: {log.rootHeight} ({log.rootOffsetHeight}px)</div>
              <div>initData: {log.initDataLength} chars</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
