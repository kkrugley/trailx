import { useEffect, useRef, useState, type RefObject } from 'react'
import { Ruler, Plus, Trash, ArrowsLeftRight, FrameCorners, ArrowCounterClockwise } from '@phosphor-icons/react'
import { useMapStore } from '../../store/useMapStore'
import { fmtDist } from '../../utils/units'
import { useT } from '../../i18n/useT'
import type { MapViewHandle } from '../MapView/MapView'
import styles from './ToolsPanel.module.css'

interface ToolsPanelProps {
  onClose: () => void
  mapRef?: RefObject<MapViewHandle | null>
}

export function ToolsPanel({ onClose, mapRef }: ToolsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const measureActive          = useMapStore((s) => s.measureActive)
  const measureSessions        = useMapStore((s) => s.measureSessions)
  const measureActiveSessionId = useMapStore((s) => s.measureActiveSessionId)
  const routeResult            = useMapStore((s) => s.routeResult)
  const waypoints              = useMapStore((s) => s.waypoints)
  const unit                   = useMapStore((s) => s.appSettings.distanceUnit)
  const {
    setMeasureActive, startMeasureSession,
    deleteMeasureSession, deleteAllMeasureSessions,
    reverseWaypoints, clearRoute,
  } = useMapStore((s) => s.actions)
  const t = useT()
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const clickHandler = (e: MouseEvent) => {
      if (measureActive) return
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', keyHandler)
    document.addEventListener('mousedown', clickHandler)
    return () => {
      document.removeEventListener('keydown', keyHandler)
      document.removeEventListener('mousedown', clickHandler)
    }
  }, [onClose, measureActive])

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
      <div className={styles.panelHeader}>{t.toolsPanel.title}</div>

      {/* ── Fit route ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <FrameCorners size={14} weight="bold" className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>{t.toolsPanel.fitRouteTitle}</span>
          <button
            className={styles.actionBtn}
            onClick={fitRoute}
            disabled={!routeResult}
            title={!routeResult ? t.toolsPanel.fitRouteDisabledHint : undefined}
          >
            {t.toolsPanel.fitRouteAction}
          </button>
        </div>
      </div>

      {/* ── Reverse route ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <ArrowsLeftRight size={14} weight="bold" className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>{t.toolsPanel.reverseTitle}</span>
          <button
            className={styles.actionBtn}
            onClick={handleReverse}
            disabled={!hasValidWaypoints}
            title={!hasValidWaypoints ? t.toolsPanel.reverseDisabledHint : undefined}
          >
            {t.toolsPanel.reverseAction}
          </button>
        </div>
      </div>

      {/* ── Clear route ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <ArrowCounterClockwise size={14} weight="bold" className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>{t.toolsPanel.clearTitle}</span>
          {confirmClear ? (
            <div className={styles.confirmRow}>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                onClick={() => { clearRoute(); setConfirmClear(false); onClose() }}
              >
                {t.toolsPanel.confirmYes}
              </button>
              <button className={styles.actionBtn} onClick={() => setConfirmClear(false)}>
                {t.toolsPanel.confirmCancel}
              </button>
            </div>
          ) : (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => setConfirmClear(true)}
              disabled={!hasValidWaypoints}
              title={!hasValidWaypoints ? t.toolsPanel.clearDisabledHint : undefined}
            >
              {t.toolsPanel.clearAction}
            </button>
          )}
        </div>
      </div>

      {/* ── Measure distance ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Ruler size={14} weight="bold" className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>{t.toolsPanel.measureTitle}</span>
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
              <p className={styles.hint}>{t.toolsPanel.measureHint}</p>
            ) : (
              <ul className={styles.sessionList}>
                {measureSessions.map((s, i) => (
                  <li
                    key={s.id}
                    className={`${styles.sessionRow} ${s.id === measureActiveSessionId ? styles.sessionActive : ''}`}
                  >
                    <span className={styles.sessionColor} style={{ background: s.color }} />
                    <span className={styles.sessionName}>{t.toolsPanel.sessionName(i + 1)}</span>
                    <span className={styles.sessionDist}>
                      {s.nodes.length < 2 ? '—' : fmtDist(s.distance * 1000, unit)}
                    </span>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteMeasureSession(s.id)}
                      aria-label={t.toolsPanel.measureDeleteAriaLabel}
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
                {t.toolsPanel.measureNewSession}
              </button>
              {measureSessions.length > 0 && (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={deleteAllMeasureSessions}
                >
                  <Trash size={13} weight="bold" />
                  {t.toolsPanel.measureDeleteAll}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
