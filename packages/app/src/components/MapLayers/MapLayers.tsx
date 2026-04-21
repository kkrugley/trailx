import { useEffect, useRef } from 'react'
import { useMapStore } from '../../store/useMapStore'
import type { AppSettings } from '../../store/useMapStore'
import { useT } from '../../i18n/useT'
import styles from './MapLayers.module.css'

interface MapLayersProps {
  onClose: () => void
}

export function MapLayers({ onClose }: MapLayersProps) {
  const settings = useMapStore((s) => s.appSettings)
  const { updateSettings } = useMapStore((s) => s.actions)
  const t = useT()
  const panelRef = useRef<HTMLDivElement>(null)

  const MAP_STYLES: { value: AppSettings['mapStyle']; label: string; description: string }[] = [
    { value: 'bright',       label: 'Classic',                description: 'OpenFreeMap Bright'   },
    { value: 'liberty',      label: 'Classic 3D',             description: 'OpenFreeMap Liberty'  },
    { value: 'positron',     label: 'Positron',               description: 'OpenFreeMap Positron' },
    { value: 'esri_imagery', label: t.mapLayers.labelSatellite, description: 'Esri World Imagery' },
    { value: 'esri_topo',    label: t.mapLayers.labelTopo,      description: 'Esri World Topo'    },
  ]

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

  function selectStyle(style: AppSettings['mapStyle']) {
    updateSettings({ mapStyle: style })
    window.dispatchEvent(new CustomEvent('trailx:setstyle', { detail: { style } }))
  }

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.panelHeader}>{t.mapLayers.panelTitle}</div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t.mapLayers.sectionStyle}</div>
        <div className={styles.styleGrid}>
          {MAP_STYLES.map((s) => (
            <button
              key={s.value}
              className={`${styles.styleBtn} ${settings.mapStyle === s.value ? styles.styleBtnActive : ''}`}
              onClick={() => selectStyle(s.value)}
            >
              <div className={`${styles.stylePreview} ${styles[`preview_${s.value}`]}`} />
              <span className={styles.styleLabel}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
