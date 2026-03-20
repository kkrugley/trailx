import { useCallback, useEffect, useRef } from 'react'
import type { RoutePoint } from '@trailx/shared'
import { useMapStore } from '../store/useMapStore'
import { buildRoute, RateLimitError } from '../services/graphhopper'

const DEBOUNCE_MS = 500

interface UseRouteReturn {
  waypoints: RoutePoint[]
  addWaypoint: (lat: number, lng: number, label?: string) => void
  removeWaypoint: (id: string) => void
  reorderWaypoints: (from: number, to: number) => void
  clearRoute: () => void
}

export function useRoute(): UseRouteReturn {
  const waypoints = useMapStore((s) => s.waypoints)
  const profile = useMapStore((s) => s.profile)
  const { addWaypoint, removeWaypoint, reorderWaypoints, clearRoute,
          setRouteResult, setIsRouting, setRouteError } =
    useMapStore((s) => s.actions)

  // ── Debounced GraphHopper call ───────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cancels the in-flight HTTP request when a newer one starts
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)

    if (waypoints.length < 2) {
      abortRef.current?.abort()
      setRouteResult(null)
      setIsRouting(false)
      setRouteError(null)
      return
    }

    timerRef.current = setTimeout(async () => {
      // Cancel any previous in-flight request before sending a new one
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsRouting(true)
      try {
        const result = await buildRoute(waypoints, profile, controller.signal)
        setRouteResult(result)
        setRouteError(null)
      } catch (err) {
        // Silently ignore our own cancellations
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

  // ── Stable wrapper for addWaypoint ──────────────────────────────────────
  const add = useCallback(
    (lat: number, lng: number, label?: string): void => {
      addWaypoint({
        id: crypto.randomUUID(),
        lat,
        lng,
        label,
        order: 0,       // recalculated by store
        type: 'start',  // recalculated by store
      })
    },
    [addWaypoint],
  )

  return {
    waypoints,
    addWaypoint: add,
    removeWaypoint,
    reorderWaypoints,
    clearRoute,
  }
}
