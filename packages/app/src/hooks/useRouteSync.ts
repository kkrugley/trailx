import { useEffect, useMemo, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'
import { buildRoute, RateLimitError } from '../services/graphhopper'
import type { LocalRoute } from '@trailx/shared'

const DEBOUNCE_MS = 500

/**
 * Mounts the debounced GraphHopper routing effect and guest autosave.
 * Call ONCE at the application root (App.tsx).
 * Components that need routing values/actions use useRoute() or useMapStore() directly.
 */
export function useRouteSync(): void {
  const waypoints = useMapStore((s) => s.waypoints)
  const profile = useMapStore((s) => s.profile)
  const appSettings = useMapStore((s) => s.appSettings)
  const authUser = useMapStore((s) => s.authUser)
  const activeLocalRouteId = useMapStore((s) => s.activeLocalRouteId)
  const activeRouteSource = useMapStore((s) => s.activeRouteSource)
  const { setRouteResult, setIsRouting, setRouteError, addLocalRoute, updateLocalRoute, setActiveLocalRouteId } =
    useMapStore((s) => s.actions)

  // Stable reference: only re-run effect when the active profile's settings actually change
  const profileSettings = appSettings[profile]
  const settingsKey = useMemo(() => JSON.stringify(profileSettings), [profileSettings])

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)

    const resolvedWaypoints = waypoints.filter((p) => !isNaN(p.lat))

    if (resolvedWaypoints.length < 2) {
      abortRef.current?.abort()
      setRouteResult(null)
      setIsRouting(false)
      setRouteError(null)
      return
    }

    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsRouting(true)
      try {
        const result = await buildRoute(resolvedWaypoints, profile, profileSettings, controller.signal)
        setRouteResult(result)
        setRouteError(null)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setRouteResult(null)
        if (err instanceof RateLimitError) {
          setRouteError('GraphHopper rate limit reached.')
        } else if (err instanceof Error) {
          setRouteError(err.message)
        } else {
          setRouteError('Routing failed.')
        }
      } finally {
        if (abortRef.current === controller) setIsRouting(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- settingsKey is a stable serialization of profileSettings
  }, [waypoints, profile, settingsKey, setRouteResult, setIsRouting, setRouteError])

  // ── Guest autosave ────────────────────────────────────────────────────────
  // When an unauthenticated user has ≥2 resolved waypoints and no non-local
  // source active, silently persist the route to localStorage as "Маршрут №N".
  useEffect(() => {
    if (authUser) return
    if (activeRouteSource && activeRouteSource.kind !== 'local') return

    const resolved = waypoints.filter((p) => !isNaN(p.lat))
    if (resolved.length < 2) return

    if (!activeLocalRouteId) {
      const id = crypto.randomUUID()
      const n = useMapStore.getState().localRoutes.length + 1
      const route: LocalRoute = {
        id,
        name: `Маршрут №${n}`,
        waypoints: resolved,
        createdAt: new Date().toISOString(),
      }
      addLocalRoute(route)
      setActiveLocalRouteId(id)
    } else {
      updateLocalRoute(activeLocalRouteId, resolved)
    }
  }, [waypoints, authUser, activeLocalRouteId, activeRouteSource, addLocalRoute, updateLocalRoute, setActiveLocalRouteId])
}
