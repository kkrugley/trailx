import { useState } from 'react'
import type { SessionPayload } from '@trailx/shared'
import { usePlatform } from './usePlatform'
import { useTelegramWebApp } from './useTelegramWebApp'
import { createSession } from '../services/api'
import { useMapStore } from '../store/useMapStore'

export interface UseShareSessionReturn {
  share: () => Promise<void>
  isCopied: boolean
  isSharing: boolean
  error: string | null
  clearError: () => void
}

const DEVICE_ID_KEY = 'trailx-device-id'
const SESSION_TOKENS_KEY = 'trailx-session-tokens'

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function saveEditToken(sessionId: string, editToken: string): void {
  const tokens = JSON.parse(localStorage.getItem(SESSION_TOKENS_KEY) ?? '{}') as Record<string, string>
  tokens[sessionId] = editToken
  localStorage.setItem(SESSION_TOKENS_KEY, JSON.stringify(tokens))
}

export function useShareSession(): UseShareSessionReturn {
  const { isMobile, isTMA } = usePlatform()
  const { webApp } = useTelegramWebApp()
  const [isCopied, setIsCopied] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function share() {
    setIsSharing(true)
    try {
      // Build auth headers
      const auth: { 'x-telegram-initdata': string } | { 'x-device-id': string } =
        isTMA && webApp?.initData
          ? { 'x-telegram-initdata': webApp.initData }
          : { 'x-device-id': getOrCreateDeviceId() }

      // Build payload from current store state
      const state = useMapStore.getState()
      const payload: SessionPayload = {
        waypoints: state.waypoints,
        routeResult: state.routeResult,
        standalonePois: state.standalonePois,
        measureSessions: state.measureSessions,
        appSettings: state.appSettings,
      }

      const session = await createSession(payload, auth)
      saveEditToken(session.id, session.editToken)

      const shareUrl = session.shareUrl

      if ((isMobile || isTMA) && typeof navigator.share === 'function') {
        await navigator.share({
          url: shareUrl,
          title: 'TrailX route',
          text: 'Посмотри мой маршрут в TrailX',
        })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('[useShareSession] share failed:', err)
      setError(err instanceof Error ? err.message : 'Не удалось поделиться маршрутом')
    } finally {
      setIsSharing(false)
    }
  }

  return { share, isCopied, isSharing, error, clearError: () => setError(null) }
}
