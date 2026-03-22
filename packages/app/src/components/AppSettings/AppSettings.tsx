import { useEffect, useRef, useState } from 'react'
import { CaretDown, ArrowCounterClockwise } from '@phosphor-icons/react'
import { useMapStore, type AppSettings } from '../../store/useMapStore'
import { kphToDisplay, displayToKph, speedUnit } from '../../utils/units'
import styles from './AppSettings.module.css'

const DEFAULT_SPEEDS = { foot: 5, bike: 20, mtb: 15, racingbike: 28 }

const DEFAULT_SETTINGS: Partial<AppSettings> = {
  language: 'ru',
  distanceUnit: 'km',
  gpxExport: { includeTrk: true, includeRte: false, includeWpt: true },
  poiBuffer: 500,
  mapStyle: 'liberty',
  speeds: { ...DEFAULT_SPEEDS },
}

interface AppSettingsProps {
  onClose: () => void
}

export function AppSettingsPanel({ onClose }: AppSettingsProps) {
  const settings = useMapStore((s) => s.appSettings)
  const { updateSettings } = useMapStore((s) => s.actions)
  const panelRef = useRef<HTMLDivElement>(null)

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

  function patch<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    updateSettings({ [key]: value } as Partial<AppSettings>)
  }

  function patchNested<K extends keyof AppSettings>(
    key: K,
    nested: Partial<AppSettings[K]>,
  ) {
    updateSettings({ [key]: { ...(settings[key] as object), ...nested } } as Partial<AppSettings>)
  }

  function resetToDefaults() {
    updateSettings(DEFAULT_SETTINGS as Partial<AppSettings>)
  }

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.panelHeader}>
        <span>Настройки</span>
        <button className={styles.resetBtn} onClick={resetToDefaults} title="Сбросить к стандартным">
          <ArrowCounterClockwise size={13} weight="bold" />
          <span>Сброс</span>
        </button>
      </div>

      {/* Language */}
      <Section title="Язык интерфейса">
        <Segmented
          options={[{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }]}
          value={settings.language}
          onChange={(v) => patch('language', v as AppSettings['language'])}
        />
      </Section>

      {/* Units */}
      <Section title="Единицы расстояния">
        <Segmented
          options={[{ value: 'km', label: 'Километры' }, { value: 'mi', label: 'Мили' }]}
          value={settings.distanceUnit}
          onChange={(v) => patch('distanceUnit', v as AppSettings['distanceUnit'])}
        />
      </Section>

      {/* Speeds — accordion */}
      <Accordion title="Скорость движения">
        <div className={styles.speedGrid}>
          {(
            [
              { key: 'foot',       label: 'Пеший' },
              { key: 'bike',       label: 'Велосипед' },
              { key: 'mtb',        label: 'Горный' },
              { key: 'racingbike', label: 'Шоссейный' },
            ] as const
          ).map(({ key, label }) => (
            <div key={key} className={styles.speedItem}>
              <span className={styles.speedLabel}>{label}</span>
              <div className={styles.spinnerWrap}>
                <input
                  type="number"
                  step={1}
                  value={kphToDisplay(settings.speeds[key], settings.distanceUnit)}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (!isNaN(v) && v > 0) patchNested('speeds', { [key]: displayToKph(v, settings.distanceUnit) })
                  }}
                  className={styles.spinnerInput}
                />
                <span className={styles.spinnerUnit}>{speedUnit(settings.distanceUnit)}</span>
              </div>
            </div>
          ))}
        </div>
      </Accordion>

      {/* GPX Export — accordion */}
      <Accordion title="Настройки экспорта GPX">
        <Toggle
          label="Включить трек (trk)"
          value={settings.gpxExport.includeTrk}
          onChange={(v) => patchNested('gpxExport', { includeTrk: v })}
        />
        <Toggle
          label="Включить маршрут (rte)"
          value={settings.gpxExport.includeRte}
          onChange={(v) => patchNested('gpxExport', { includeRte: v })}
        />
        <Toggle
          label="Включить точки POI (wpt)"
          value={settings.gpxExport.includeWpt}
          onChange={(v) => patchNested('gpxExport', { includeWpt: v })}
        />
      </Accordion>

      {/* Info */}
      <div className={styles.infoRow}>
        <span className={styles.infoText}>TrailX — планировщик велосипедных маршрутов</span>
        <span className={styles.infoVersion}>v1.0</span>
      </div>
    </div>
  )
}

/* ── Reusable sub-components ──────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  )
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`${styles.section} ${styles.accordionSection}`}>
      <button
        className={styles.accordionBtn}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.sectionTitle} style={{ marginBottom: 0 }}>{title}</span>
        <span className={`${styles.accordionCaret} ${open ? styles.accordionCaretOpen : ''}`}>
          <CaretDown size={11} weight="bold" />
        </span>
      </button>
      {open && <div className={styles.accordionBody}>{children}</div>}
    </div>
  )
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className={styles.segmented}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`${styles.seg} ${value === opt.value ? styles.segActive : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.toggleRow}>
      <span className={styles.toggleLabel}>{label}</span>
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
