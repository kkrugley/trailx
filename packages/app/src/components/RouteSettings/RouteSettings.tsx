import { useRef, useEffect } from 'react'
import { useMapStore, type AppSettings } from '../../store/useMapStore'
import type { RoutingProfile } from '@trailx/shared'
import styles from './RouteSettings.module.css'

interface RouteSettingsProps {
  profile: RoutingProfile
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

export function RouteSettings({ profile, onClose, anchorRef }: RouteSettingsProps) {
  const settings = useMapStore((s) => s.appSettings)
  const { updateSettings } = useMapStore((s) => s.actions)
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
      {/* General */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Общие</div>
        <label className={styles.row}>
          <span className={styles.label}>Единицы расстояния</span>
          <div className={styles.segmented}>
            {(['km', 'mi'] as const).map((unit) => (
              <button
                key={unit}
                className={`${styles.seg} ${settings.distanceUnit === unit ? styles.segActive : ''}`}
                onClick={() => updateSettings({ distanceUnit: unit })}
              >
                {unit === 'km' ? 'км' : 'миль'}
              </button>
            ))}
          </div>
        </label>
      </div>

      {/* Profile-specific */}
      {profile === 'foot' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Пеший маршрут</div>
          <Toggle
            label="Предпочитать пешеходные дорожки"
            value={settings.foot.preferFootpaths}
            onChange={(v) => patchProfile('foot', { preferFootpaths: v })}
          />
          <Toggle
            label="Избегать проезжих дорог"
            value={settings.foot.avoidRoads}
            onChange={(v) => patchProfile('foot', { avoidRoads: v })}
          />
        </div>
      )}

      {profile === 'bike' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Велосипед</div>
          <div className={styles.radioGroup}>
            {([
              ['fastest', 'Быстрейший'],
              ['safest', 'Безопасный'],
              ['short', 'Кратчайший'],
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
            label="Избегать автомагистралей"
            value={settings.bike.avoidHighways}
            onChange={(v) => patchProfile('bike', { avoidHighways: v })}
          />
        </div>
      )}

      {profile === 'mtb' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Горный велосипед</div>
          <div className={styles.radioGroup}>
            {([
              ['low', 'Лёгкий рельеф'],
              ['medium', 'Средний рельеф'],
              ['high', 'Сложный рельеф'],
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
            label="Избегать асфальтированных дорог"
            value={settings.mtb.avoidPaved}
            onChange={(v) => patchProfile('mtb', { avoidPaved: v })}
          />
        </div>
      )}

      {profile === 'racingbike' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Шоссейный велосипед</div>
          <div className={styles.radioGroup}>
            {([
              ['fastest', 'Быстрейший'],
              ['short', 'Кратчайший'],
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
            label="Избегать брусчатки"
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
