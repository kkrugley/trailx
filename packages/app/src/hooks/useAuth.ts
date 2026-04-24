import { useEffect, useCallback } from 'react'
import type { AuthUser } from '@trailx/shared'
import { usePlatform } from './usePlatform'
import { useTelegramWebApp } from './useTelegramWebApp'
import { useMapStore } from '../store/useMapStore'
import { verifyTelegramToken, getMe, loginWithTMA, logout as apiLogout } from '../services/api'

export interface UseAuthReturn {
  authUser: AuthUser | null
  isLoggedIn: boolean
  isSimulated: boolean
  logout: () => Promise<void>
  onTelegramSDKCallback: (idToken: string) => Promise<void>
}

const SIMULATED_USER: AuthUser = {
  id: 'debug-user-123',
  telegramId: 123456789,
  name: 'Debug User',
  username: 'debuguser',
  avatarUrl: undefined,
}

export function useAuth(): UseAuthReturn {
  const { isTMA } = usePlatform()
  const { webApp } = useTelegramWebApp()
  const authUser = useMapStore((s) => s.authUser)
  const debugSimulateAuth = useMapStore((s) => s.debugSimulateAuth)
  const { setAuthUser } = useMapStore((s) => s.actions)

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (isTMA && webApp?.initData) {
        try {
          const user = await loginWithTMA(webApp.initData)
          if (!cancelled) setAuthUser(user)
        } catch {
          // Non-fatal: TMA can still work without being "logged in" to web auth
        }
        return
      }

      try {
        const user = await getMe()
        if (!cancelled && user) setAuthUser(user)
      } catch {
        // Unauthenticated is valid state
      }
    }

    void init()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTMA, webApp?.initData])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      setAuthUser(null)
    }
  }, [setAuthUser])

  const onTelegramSDKCallback = useCallback(async (idToken: string) => {
    try {
      const user = await verifyTelegramToken(idToken)
      setAuthUser(user)
    } catch (err) {
      console.error('[useAuth] Telegram SDK verification failed:', err)
    }
  }, [setAuthUser])

  // Return simulated user when debug mode is active
  if (debugSimulateAuth) {
    return {
      authUser: SIMULATED_USER,
      isLoggedIn: true,
      isSimulated: true,
      logout: async () => {},
      onTelegramSDKCallback: async () => {},
    }
  }

  return {
    authUser,
    isLoggedIn: authUser !== null,
    isSimulated: false,
    logout,
    onTelegramSDKCallback,
  }
}
