import { useCallback } from 'react'
import type { RoutePoint } from '@trailx/shared'
import { useMapStore } from '../store/useMapStore'

interface UseRouteReturn {
  waypoints: RoutePoint[]
  addWaypoint: (lat: number, lng: number, label?: string) => void
  removeWaypoint: (id: string) => void
  reorderWaypoints: (from: number, to: number) => void
  clearRoute: () => void
}

export function useRoute(): UseRouteReturn {
  const waypoints = useMapStore((s) => s.waypoints)
  const { addWaypoint, removeWaypoint, reorderWaypoints, clearRoute } =
    useMapStore((s) => s.actions)

  const add = useCallback(
    (lat: number, lng: number, label?: string): void => {
      addWaypoint({
        id: crypto.randomUUID(),
        lat,
        lng,
        label,
        order: 0,
        type: 'start',
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
