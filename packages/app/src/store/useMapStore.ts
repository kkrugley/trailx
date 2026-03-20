import { create } from 'zustand'
import type { RoutePoint, RouteResult, RoutingProfile } from '@trailx/shared'

// Re-assigns order and type to every point based on array position.
function assignTypes(points: RoutePoint[]): RoutePoint[] {
  const last = points.length - 1
  return points.map((p, i) => ({
    ...p,
    order: i,
    type: i === 0 ? 'start' : i === last ? 'end' : 'intermediate',
  }))
}

interface MapStoreActions {
  addWaypoint: (point: RoutePoint) => void
  removeWaypoint: (id: string) => void
  reorderWaypoints: (from: number, to: number) => void
  clearRoute: () => void
  setRouteResult: (result: RouteResult | null) => void
  setIsRouting: (value: boolean) => void
  setProfile: (profile: RoutingProfile) => void
  setRouteError: (err: string | null) => void
}

interface MapStore {
  waypoints: RoutePoint[]
  activeRouteId: string | null
  routeResult: RouteResult | null
  isRouting: boolean
  profile: RoutingProfile
  routeError: string | null
  actions: MapStoreActions
}

export const useMapStore = create<MapStore>((set) => ({
  waypoints: [],
  activeRouteId: null,
  routeResult: null,
  isRouting: false,
  profile: 'bike',
  routeError: null,

  actions: {
    addWaypoint: (point) =>
      set((state) => ({
        waypoints: assignTypes([...state.waypoints, point]),
      })),

    removeWaypoint: (id) =>
      set((state) => ({
        waypoints: assignTypes(state.waypoints.filter((p) => p.id !== id)),
      })),

    reorderWaypoints: (from, to) =>
      set((state) => {
        const items = [...state.waypoints]
        const [moved] = items.splice(from, 1)
        items.splice(to, 0, moved)
        return { waypoints: assignTypes(items) }
      }),

    clearRoute: () => set({ waypoints: [], routeResult: null, routeError: null }),

    setRouteResult: (result) => set({ routeResult: result }),

    setIsRouting: (value) => set({ isRouting: value }),

    setProfile: (profile) => set({ profile }),

    setRouteError: (err) => set({ routeError: err }),
  },
}))
