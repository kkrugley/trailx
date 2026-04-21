import { useEffect, useRef, useState } from 'react'
import { CaretDown, ArrowCounterClockwise } from '@phosphor-icons/react'
import { useMapStore, type AppSettings } from '../../store/useMapStore'
import { kphToDisplay, displayToKph, speedUnit } from '../../utils/units'
import { useT } from '../../i18n/useT'
import styles from './AppSettings.module.css'

const DEFAULT_SPEEDS = { foot: 5, bike: 20, mtb: 15, racingbike: 28 }

const DEFAULT_SETTINGS: Partial<AppSettings> = {
  language: 'ru',
  distanceUnit: 'km',
  gpxExport: { includeTrk: true, includeRte: false, includeWpt: true },
  poiBuffer: 500,
  mapStyle: 'bright',
  autoFitRoute: true,
  speeds: { ...DEFAULT_SPEEDS },
}

interface AppSettingsProps {
  onClose: () => void
}

export function AppSettingsPanel({ onClose }: AppSettingsProps) {
  const settings = useMapStore((s) => s.appSettings)
  const { updateSettings } = useMapStore((s) => s.actions)
  const t = useT()
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
        <span>{t.appSettings.title}</span>
        <button className={styles.resetBtn} onClick={resetToDefaults} title={t.appSettings.resetTitle}>
          <ArrowCounterClockwise size={13} weight="bold" />
          <span>{t.appSettings.resetLabel}</span>
        </button>
      </div>

      {/* Language */}
      <Section title={t.appSettings.sectionLanguage}>
        <Segmented
          options={[{ value: 'ru', label: t.appSettings.langRu }, { value: 'en', label: t.appSettings.langEn }]}
          value={settings.language}
          onChange={(v) => patch('language', v as AppSettings['language'])}
        />
      </Section>

      {/* Units */}
      <Section title={t.appSettings.sectionUnits}>
        <Segmented
          options={[{ value: 'km', label: t.appSettings.unitKm }, { value: 'mi', label: t.appSettings.unitMi }]}
          value={settings.distanceUnit}
          onChange={(v) => patch('distanceUnit', v as AppSettings['distanceUnit'])}
        />
      </Section>

      {/* Map — auto-fit */}
      <Section title={t.appSettings.sectionMap}>
        <Toggle
          label={t.appSettings.autoFit}
          value={settings.autoFitRoute}
          onChange={(v) => updateSettings({ autoFitRoute: v })}
        />
      </Section>

      {/* Speeds — accordion */}
      <Accordion title={t.appSettings.sectionSpeeds}>
        <div className={styles.speedGrid}>
          {(
            [
              { key: 'foot',       label: t.appSettings.speedFoot },
              { key: 'bike',       label: t.appSettings.speedBike },
              { key: 'mtb',        label: t.appSettings.speedMtb },
              { key: 'racingbike', label: t.appSettings.speedRacingbike },
            ] as const
          ).map(({ key, label }) => (
            <SpeedInput
              key={key}
              speedKey={key}
              label={label}
              settings={settings}
              patchNested={patchNested}
              speedUnitLabel={t.units.speedKmh}
            />
          ))}
        </div>
      </Accordion>

      {/* GPX Export — accordion */}
      <Accordion title={t.appSettings.sectionGpx}>
        <Toggle
          label={t.appSettings.gpxIncludeTrk}
          value={settings.gpxExport.includeTrk}
          onChange={(v) => patchNested('gpxExport', { includeTrk: v })}
        />
        <Toggle
          label={t.appSettings.gpxIncludeRte}
          value={settings.gpxExport.includeRte}
          onChange={(v) => patchNested('gpxExport', { includeRte: v })}
        />
        <Toggle
          label={t.appSettings.gpxIncludeWpt}
          value={settings.gpxExport.includeWpt}
          onChange={(v) => patchNested('gpxExport', { includeWpt: v })}
        />
      </Accordion>

      {/* Info */}
      <div className={styles.infoRow}>
        <span className={styles.infoText}>{t.appSettings.footer}</span>
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

function SpeedInput({
  speedKey,
  label,
  settings,
  patchNested,
  speedUnitLabel,
}: {
  speedKey: 'foot' | 'bike' | 'mtb' | 'racingbike'
  label: string
  settings: AppSettings
  patchNested: <K extends keyof AppSettings>(key: K, nested: Partial<AppSettings[K]>) => void
  speedUnitLabel?: string
}) {
  const [raw, setRaw] = useState(
    () => String(kphToDisplay(settings.speeds[speedKey], settings.distanceUnit)),
  )

  useEffect(() => {
    setRaw(String(kphToDisplay(settings.speeds[speedKey], settings.distanceUnit)))
  }, [settings.distanceUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.speedItem}>
      <span className={styles.speedLabel}>{label}</span>
      <div className={styles.spinnerWrap}>
        <input
          type="number"
          step={1}
          value={raw}
          onChange={(e) => {
            const text = e.target.value
            setRaw(text)
            const v = parseFloat(text)
            if (!isNaN(v) && v > 0) {
              patchNested('speeds', { [speedKey]: displayToKph(v, settings.distanceUnit) })
            }
          }}
          className={styles.spinnerInput}
        />
        <span className={styles.spinnerUnit}>{speedUnit(settings.distanceUnit, speedUnitLabel)}</span>
      </div>
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
