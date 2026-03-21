import { useEffect, useRef } from 'react'
import { Ruler, Plus, Trash } from '@phosphor-icons/react'
import { useMapStore } from '../../store/useMapStore'
import styles from './ToolsPanel.module.css'

interface ToolsPanelProps {
  onClose: () => void
}

function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} м`
  return `${km.toFixed(2)} км`
}

export function ToolsPanel({ onClose }: ToolsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const measureActive   = useMapStore((s) => s.measureActive)
  const measureSessions = useMapStore((s) => s.measureSessions)
  const measureActiveSessionId = useMapStore((s) => s.measureActiveSessionId)
  const {
    setMeasureActive, startMeasureSession,
    deleteMeasureSession, deleteAllMeasureSessions,
  } = useMapStore((s) => s.actions)

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', keyHandler)
    return () => document.removeEventListener('keydown', keyHandler)
  }, [onClose])

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.panelHeader}>Инструменты</div>

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
