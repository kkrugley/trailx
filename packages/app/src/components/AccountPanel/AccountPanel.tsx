import { useEffect, useState } from 'react'
import { FloppyDisk, X } from '@phosphor-icons/react'
import type { LocalRoute, SavedRouteDTO } from '@trailx/shared'
import { usePlatform } from '../../hooks/usePlatform'
import { useTelegramWebApp } from '../../hooks/useTelegramWebApp'
import { useMapStore } from '../../store/useMapStore'
import { useAuth } from '../../hooks/useAuth'
import { useSavedRoutes } from '../../hooks/useSavedRoutes'
import { RouteListItem } from './RouteListItem'
import { SaveRouteModal } from './SaveRouteModal'
import styles from './AccountPanel.module.css'

interface AccountPanelProps {
  onClose?: () => void
}

export function AccountPanel({ onClose }: AccountPanelProps) {
  const { isTMA } = usePlatform()
  const { webApp } = useTelegramWebApp()
  const { authUser, isLoggedIn, isSimulated, logout, loginWithTelegram } = useAuth()
  const { savedRoutes, isLoading, isMigrating, saveCurrentRoute, deleteRoute, loadRoute } = useSavedRoutes()
  const localRoutes = useMapStore((s) => s.localRoutes)
  const waypoints = useMapStore((s) => s.waypoints)

  const [showSaveModal, setShowSaveModal] = useState(false)

  const canSave = waypoints.filter((w) => !isNaN(w.lat)).length >= 2

  // TMA BackButton to close panel
  useEffect(() => {
    if (!isTMA || !webApp?.BackButton) return
    webApp.BackButton.show()
    webApp.BackButton.onClick(() => onClose?.())
    return () => { webApp.BackButton?.hide() }
  }, [isTMA, webApp, onClose])


  function initials(name: string) {
    return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  }

  // TMA waiting for auto-login
  if (isTMA && !isLoggedIn) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.headerLabel}>Account</span>
        </div>
        <div className={styles.loading}>
          <div className={styles.spinner} />
        </div>
      </div>
    )
  }

  // Web — not logged in
  if (!isLoggedIn) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.headerLabel}>Account</span>
          {onClose && (
            <button className={styles.iconBtn} onClick={onClose} aria-label="Close">
              <X size={14} weight="regular" />
            </button>
          )}
        </div>
        <div className={styles.loginSection}>
          <p className={styles.loginHint}>
            Sign in to save routes and access them from any device.
          </p>
          {/* SDK renders into this container and transforms the button */}
          <button className={styles.loginBtn} onClick={loginWithTelegram}>
            Sign in with Telegram
          </button>
        </div>

        {localRoutes.length > 0 && (
          <div className={styles.routeSection}>
            <span className={styles.sectionLabel}>Local Routes</span>
            {localRoutes.map((r: LocalRoute) => (
              <RouteListItem
                key={r.id}
                route={r}
                onLoad={() => loadRoute(r)}
                onDelete={() => deleteRoute(r.id)}
              />
            ))}
            <p className={styles.localHint}>
              These routes will sync to your account after sign in.
            </p>
          </div>
        )}
      </div>
    )
  }

  // Logged in
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Account</span>
        {onClose && (
          <button className={styles.iconBtn} onClick={onClose} aria-label="Close">
            <X size={14} weight="regular" />
          </button>
        )}
      </div>

      <div className={styles.userRow}>
        {authUser!.avatarUrl ? (
          <img
            className={styles.avatar}
            src={authUser!.avatarUrl}
            alt={authUser!.name}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={styles.avatarFallback}>
            {initials(authUser!.name)}
          </div>
        )}
        <div className={styles.userInfo}>
          <span className={styles.userName}>{authUser!.name}</span>
          {isSimulated && (
            <span className={styles.userHandle}>Debug Mode</span>
          )}
          {authUser!.username && !isSimulated && (
            <span className={styles.userHandle}>@{authUser!.username}</span>
          )}
        </div>
        <button className={styles.logoutBtn} onClick={logout}>
          Sign out
        </button>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.saveBtn}
          disabled={!canSave}
          onClick={() => setShowSaveModal(true)}
        >
          <FloppyDisk size={15} weight="regular" />
          Save current route
        </button>
      </div>

      <div className={styles.routeSection}>
        <span className={styles.sectionLabel}>Saved Routes</span>
        {isLoading || isMigrating ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
          </div>
        ) : savedRoutes.length === 0 ? (
          <p className={styles.emptyHint}>No saved routes yet.</p>
        ) : (
          savedRoutes.map((r: SavedRouteDTO) => (
            <RouteListItem
              key={r.id}
              route={r}
              onLoad={() => { loadRoute(r); onClose?.() }}
              onDelete={() => deleteRoute(r.id)}
            />
          ))
        )}
      </div>

      {showSaveModal && (
        <SaveRouteModal
          onSave={saveCurrentRoute}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  )
}
