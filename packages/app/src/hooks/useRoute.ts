import { useCallback, useEffect, useRef } from 'react'
import type { RoutePoint } from '@trailx/shared'
import { useMapStore } from '../store/useMapStore'
import { buildRoute, RateLimitError } from '../services/graphhopper'

const DEBOUNCE_MS = 500
const DEFAULT_PROFILE = 'bike' as const

interface UseRouteReturn {
  waypoints: RoutePoint[]
  addWaypoint: (lat: number, lng: number, label?: string) => void
  removeWaypoint: (id: string) => void
  reorderWaypoints: (from: number, to: number) => void
  clearRoute: () => void
}

export function useRoute(): UseRouteReturn {
  const waypoints = useMapStore((s) => s.waypoints)
  const { addWaypoint, removeWaypoint, reorderWaypoints, clearRoute,
          setRouteResult, setIsRouting } =
    useMapStore((s) => s.actions)

  // ── Debounced GraphHopper call ───────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track in-flight request so we can ignore stale responses
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)

    if (waypoints.length < 2) {
      setRouteResult(null)
      setIsRouting(false)
      return
    }

    const currentId = ++requestIdRef.current
    timerRef.current = setTimeout(async () => {
      setIsRouting(true)
      try {
        const result = await buildRoute(waypoints, DEFAULT_PROFILE)
        if (requestIdRef.current !== currentId) return // stale response
        setRouteResult(result)
      } catch (err) {
        if (requestIdRef.current !== currentId) return
        setRouteResult(null)
        if (err instanceof RateLimitError) {
          // Bubble the error for MapView to show as a toast
          // We store it as a special sentinel in the store via a custom event
          window.dispatchEvent(new CustomEvent('trailx:ratelimit'))
        }
      } finally {
        if (requestIdRef.current === currentId) setIsRouting(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [waypoints, setRouteResult, setIsRouting])

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
