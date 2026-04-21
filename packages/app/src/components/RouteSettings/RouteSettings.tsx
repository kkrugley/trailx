import { useRef, useEffect } from 'react'
import { useMapStore, type AppSettings } from '../../store/useMapStore'
import type { RoutingProfile } from '@trailx/shared'
import { useT } from '../../i18n/useT'
import styles from './RouteSettings.module.css'

interface RouteSettingsProps {
  profile: RoutingProfile
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

export function RouteSettings({ profile, onClose, anchorRef }: RouteSettingsProps) {
  const settings = useMapStore((s) => s.appSettings)
  const { updateSettings } = useMapStore((s) => s.actions)
  const t = useT()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose, anchorRef])

  function patchProfile<K extends keyof AppSettings>(
    key: K,
    patch: Partial<AppSettings[K]>,
  ) {
    updateSettings({ [key]: { ...(settings[key] as object), ...patch } } as Partial<AppSettings>)
  }

  return (
    <div ref={panelRef} className={styles.panel}>
      {/* Profile-specific */}
      {profile === 'foot' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t.routeSettings.sectionFoot}</div>
          <Toggle
            label={t.routeSettings.preferFootpaths}
            value={settings.foot.preferFootpaths}
            onChange={(v) => patchProfile('foot', { preferFootpaths: v })}
          />
          <Toggle
            label={t.routeSettings.avoidRoads}
            value={settings.foot.avoidRoads}
            onChange={(v) => patchProfile('foot', { avoidRoads: v })}
          />
        </div>
      )}

      {profile === 'bike' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t.routeSettings.sectionBike}</div>
          <div className={styles.radioGroup}>
            {([
              ['fastest', t.routeSettings.routeFastest],
              ['safest', t.routeSettings.routeSafest],
              ['short', t.routeSettings.routeShort],
            ] as const).map(([val, lbl]) => (
              <label key={val} className={styles.radioRow}>
                <input
                  type="radio"
                  name="bike-route"
                  checked={settings.bike.routeType === val}
                  onChange={() => patchProfile('bike', { routeType: val })}
                />
                <span>{lbl}</span>
              </label>
            ))}
          </div>
          <Toggle
            label={t.routeSettings.avoidHighways}
            value={settings.bike.avoidHighways}
            onChange={(v) => patchProfile('bike', { avoidHighways: v })}
          />
        </div>
      )}

      {profile === 'mtb' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t.routeSettings.sectionMtb}</div>
          <div className={styles.radioGroup}>
            {([
              ['low', t.routeSettings.terrainEasy],
              ['medium', t.routeSettings.terrainMedium],
              ['high', t.routeSettings.terrainHard],
            ] as const).map(([val, lbl]) => (
              <label key={val} className={styles.radioRow}>
                <input
                  type="radio"
                  name="mtb-difficulty"
                  checked={settings.mtb.difficulty === val}
                  onChange={() => patchProfile('mtb', { difficulty: val })}
                />
                <span>{lbl}</span>
              </label>
            ))}
          </div>
          <Toggle
            label={t.routeSettings.avoidPaved}
            value={settings.mtb.avoidPaved}
            onChange={(v) => patchProfile('mtb', { avoidPaved: v })}
          />
        </div>
      )}

      {profile === 'racingbike' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t.routeSettings.sectionRacing}</div>
          <div className={styles.radioGroup}>
            {([
              ['fastest', t.routeSettings.routeFastest],
              ['short', t.routeSettings.routeShort],
            ] as const).map(([val, lbl]) => (
              <label key={val} className={styles.radioRow}>
                <input
                  type="radio"
                  name="racing-route"
                  checked={settings.racingbike.routeType === val}
                  onChange={() => patchProfile('racingbike', { routeType: val })}
                />
                <span>{lbl}</span>
              </label>
            ))}
          </div>
          <Toggle
            label={t.routeSettings.avoidCobblestones}
            value={settings.racingbike.avoidCobblestones}
            onChange={(v) => patchProfile('racingbike', { avoidCobblestones: v })}
          />
        </div>
      )}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.toggleRow}>
      <span className={styles.label}>{label}</span>
      <button
        role="switch"
        aria-checked={value}
        className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
        onClick={() => onChange(!value)}
      >
        <span className={styles.toggleThumb} />
      </button>
    </label>
  )
}
