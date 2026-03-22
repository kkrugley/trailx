import { useEffect, useRef, type RefObject } from 'react'
import { Ruler, Plus, Trash, ArrowsLeftRight, FrameCorners } from '@phosphor-icons/react'
import { useMapStore } from '../../store/useMapStore'
import type { MapViewHandle } from '../MapView/MapView'
import styles from './ToolsPanel.module.css'

interface ToolsPanelProps {
  onClose: () => void
  mapRef?: RefObject<MapViewHandle | null>
}

function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} м`
  return `${km.toFixed(2)} км`
}

export function ToolsPanel({ onClose, mapRef }: ToolsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const measureActive          = useMapStore((s) => s.measureActive)
  const measureSessions        = useMapStore((s) => s.measureSessions)
  const measureActiveSessionId = useMapStore((s) => s.measureActiveSessionId)
  const routeResult            = useMapStore((s) => s.routeResult)
  const waypoints              = useMapStore((s) => s.waypoints)
  const {
    setMeasureActive, startMeasureSession,
    deleteMeasureSession, deleteAllMeasureSessions,
    reverseWaypoints,
  } = useMapStore((s) => s.actions)

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const clickHandler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', keyHandler)
    document.addEventListener('mousedown', clickHandler)
    return () => {
      document.removeEventListener('keydown', keyHandler)
      document.removeEventListener('mousedown', clickHandler)
    }
  }, [onClose])

  const hasValidWaypoints = waypoints.filter((w) => !isNaN(w.lat)).length >= 2

  function fitRoute() {
    const map = mapRef?.current?.getMap()
    if (!map || !routeResult) return
    const coords = routeResult.geometry.coordinates as [number, number][]
    const lngs = coords.map(([lng]) => lng)
    const lats = coords.map(([, lat]) => lat)
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 60, duration: 600 },
    )
    onClose()
  }

  function handleReverse() {
    reverseWaypoints()
    onClose()
  }

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.panelHeader}>Инструменты</div>

      {/* ── Fit route ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <FrameCorners size={14} weight="bold" className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>По маршруту</span>
          <button
            className={styles.actionBtn}
            onClick={fitRoute}
            disabled={!routeResult}
            title={!routeResult ? 'Сначала постройте маршрут' : undefined}
          >
            Центрировать
          </button>
        </div>
      </div>

      {/* ── Reverse route ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <ArrowsLeftRight size={14} weight="bold" className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>Обратить маршрут</span>
          <button
            className={styles.actionBtn}
            onClick={handleReverse}
            disabled={!hasValidWaypoints}
            title={!hasValidWaypoints ? 'Добавьте точки маршрута' : undefined}
          >
            Обратить
          </button>
        </div>
      </div>

      {/* ── Measure distance ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Ruler size={14} weight="bold" className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>Измерение расстояний</span>
          <button
            role="switch"
            aria-checked={measureActive}
            className={`${styles.toggle} ${measureActive ? styles.toggleOn : ''}`}
            onClick={() => setMeasureActive(!measureActive)}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>

        {measureActive && (
          <div className={styles.measureBody}>
            {measureSessions.length === 0 ? (
              <p className={styles.hint}>Кликните по карте, чтобы добавить точку</p>
            ) : (
              <ul className={styles.sessionList}>
                {measureSessions.map((s, i) => (
                  <li
                    key={s.id}
                    className={`${styles.sessionRow} ${s.id === measureActiveSessionId ? styles.sessionActive : ''}`}
                  >
                    <span className={styles.sessionName}>Замер {i + 1}</span>
                    <span className={styles.sessionDist}>
                      {s.nodes.length < 2 ? '—' : fmtDistance(s.distance)}
                    </span>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteMeasureSession(s.id)}
                      aria-label="Удалить замер"
                    >
                      <Trash size={13} weight="bold" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.measureActions}>
              <button className={styles.actionBtn} onClick={startMeasureSession}>
                <Plus size={13} weight="bold" />
                Начать новое
              </button>
              {measureSessions.length > 0 && (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={deleteAllMeasureSessions}
                >
                  <Trash size={13} weight="bold" />
                  Стереть все
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
