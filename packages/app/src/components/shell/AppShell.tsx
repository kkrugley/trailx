import { usePlatform } from '../../hooks/usePlatform'
import { MapView } from '../MapView/MapView'
import { SidePanel } from './SidePanel'
import { BottomSheet } from './BottomSheet'
import { ActionBar } from './ActionBar'
import styles from './AppShell.module.css'

export function AppShell() {
  const { isMobile, isTMA } = usePlatform()
  const isDesktop = !isMobile && !isTMA

  if (isDesktop) {
    return (
      <div className={`${styles.shell} ${styles.desktop}`}>
        <SidePanel />
        <div className={styles.desktopMap}>
          <MapView />
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.shell} ${styles.mobile}`}>
      <div className={styles.mobileMap}>
        <MapView />
      </div>
      <BottomSheet />
      <ActionBar />
    </div>
  )
}
