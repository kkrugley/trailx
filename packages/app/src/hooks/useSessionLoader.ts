import { useEffect, useState } from 'react'
import type { RoutePoint, RouteResult, POI } from '@trailx/shared'
import type { AppSettings, MeasureSession } from '../store/useMapStore'
import { getSession, SessionNotFoundError } from '../services/api'
import { useMapStore } from '../store/useMapStore'

export interface UseSessionLoaderReturn {
  isLoading: boolean
  error: string | null
}

function parseSessionId(): string | null {
  // Path: /s/:id
  const pathMatch = window.location.pathname.match(/^\/s\/([^/?#]+)/)
  if (pathMatch) return pathMatch[1]
  // Query: ?session=<id>
  return new URLSearchParams(window.location.search).get('session')
}

function cleanUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('session')
  if (url.pathname.startsWith('/s/')) {
    url.pathname = '/'
  }
  history.replaceState(null, '', url.toString())
}

export function useSessionLoader(): UseSessionLoaderReturn {
  const [isLoading, setIsLoading] = useState(() => parseSessionId() !== null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sessionId = parseSessionId()
    if (!sessionId) return

    let cancelled = false

    async function load() {
      try {
        const { payload } = await getSession(sessionId!)
        if (cancelled) return

        const {
          clearRoute, addWaypoint, setRouteResult, updateSettings,
          setStandalonePois, setMeasureSessions,
        } = useMapStore.getState().actions

        // Restore waypoints
        clearRoute()
        for (const wp of payload.waypoints as RoutePoint[]) {
          addWaypoint(wp)
        }

        // Restore route result
        setRouteResult(payload.routeResult as RouteResult | null)

        // Restore standalone POIs and measure sessions
        setStandalonePois(payload.standalonePois as POI[])
        setMeasureSessions(payload.measureSessions as MeasureSession[])

        // Restore settings
        updateSettings(payload.appSettings as Partial<AppSettings>)

        cleanUrl()
      } catch (err) {
        if (cancelled) return
        if (err instanceof SessionNotFoundError) {
          setError('Сессия не найдена или истекла')
        } else {
          console.error('[useSessionLoader]', err)
          setError('Не удалось загрузить сессию')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  return { isLoading, error }
}
