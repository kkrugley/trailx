import { useRef, useState } from 'react'
import { Export, UploadSimple, X } from '@phosphor-icons/react'
import { parseGPX } from '@trailx/shared'
import { exportRoute } from '../../services/gpx'
import { useMapStore } from '../../store/useMapStore'
import styles from './ExportPanel.module.css'

export function ExportPanel() {
  const routeResult = useMapStore((s) => s.routeResult)
  const { loadRouteFromGPX } = useMapStore((s) => s.actions)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [parseError, setParseError] = useState(false)

  const hasRoute = routeResult !== null

  function handleFile(file: File) {
    setParseError(false)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== 'string') { setParseError(true); return }
      try {
        const gpxFile = parseGPX(text)
        loadRouteFromGPX(gpxFile)
      } catch {
        setParseError(true)
      }
    }
    reader.readAsText(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so the same file can be re-imported
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        {/* Import zone — click or drag & drop */}
        <button
          className={`${styles.importZone} ${isDragging ? styles.dragging : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          aria-label="Import GPX file"
        >
          <UploadSimple size={18} weight="regular" />
          <span>Импорт GPX</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          className={styles.hiddenInput}
          onChange={handleFileInput}
          aria-hidden
        />

        {/* Export button */}
        <button
          className={styles.exportButton}
          onClick={exportRoute}
          disabled={!hasRoute}
          aria-label="Export route as GPX"
          aria-disabled={!hasRoute}
        >
          <Export size={18} weight="regular" />
          <span>Экспорт GPX</span>
        </button>
      </div>

      {/* Parse error toast */}
      {parseError && (
        <div className={styles.errorToast} role="alert">
          <span>Не удалось прочитать GPX файл</span>
          <button
            className={styles.errorDismiss}
            onClick={() => setParseError(false)}
            aria-label="Dismiss error"
          >
            <X size={13} weight="bold" />
          </button>
        </div>
      )}
    </div>
  )
}
