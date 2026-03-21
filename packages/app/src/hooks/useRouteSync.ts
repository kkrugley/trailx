import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'
import { buildRoute, RateLimitError } from '../services/graphhopper'

const DEBOUNCE_MS = 500

/**
 * Mounts the debounced GraphHopper routing effect.
 * Call ONCE at the application root (App.tsx).
 * Components that need routing values/actions use useRoute() or useMapStore() directly.
 */
export function useRouteSync(): void {
  const waypoints = useMapStore((s) => s.waypoints)
  const profile = useMapStore((s) => s.profile)
  const { setRouteResult, setIsRouting, setRouteError } =
    useMapStore((s) => s.actions)

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
        const result = await buildRoute(resolvedWaypoints, profile, controller.signal)
        setRouteResult(result)
        setRouteError(null)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setRouteResult(null)
        if (err instanceof RateLimitError) {
          setRouteError('GraphHopper rate limit reached. Add your API key via VITE_GRAPHHOPPER_API_KEY.')
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
  }, [waypoints, profile, setRouteResult, setIsRouting, setRouteError])
}
