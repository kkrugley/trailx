import { Export, Check, ShareNetwork } from '@phosphor-icons/react'
// TODO: import GPX moved — restore in WaypointInputList or standalone ImportButton
// import { useState } from 'react'
// import { parseGPX } from '@trailx/shared'
import { exportRoute } from '../../services/gpx'
import { useMapStore } from '../../store/useMapStore'
import { useShareSession } from '../../hooks/useShareSession'
import styles from './ExportPanel.module.css'

export function ExportPanel() {
  const routeResult = useMapStore((s) => s.routeResult)
  // TODO: import GPX moved — restore in WaypointInputList or standalone ImportButton
  // const { loadRouteFromGPX } = useMapStore((s) => s.actions)
  const { share, isCopied, isSharing } = useShareSession()

  const hasRoute = routeResult !== null

  // TODO: import GPX moved — restore in WaypointInputList or standalone ImportButton
  // function handleFile(file: File) { ... }
  // function handleFileInput(...) { ... }
  // function handleDrop(...) { ... }
  // function handleDragOver(...) { ... }
  // function handleDragLeave() { ... }

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        {/* Share button */}
        <button
          className={`${styles.shareButton} ${isCopied ? styles.shareButtonCopied : ''}`}
          onClick={share}
          disabled={isSharing}
          aria-label="Share route"
        >
          {isCopied
            ? <><Check size={18} weight="bold" /><span>Скопировано!</span></>
            : <><ShareNetwork size={18} weight="regular" /><span>Поделиться</span></>
          }
        </button>

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
    </div>
  )
}
