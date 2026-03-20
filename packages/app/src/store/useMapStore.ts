import { create } from 'zustand'
import type { RoutePoint, RouteResult, RoutingProfile, POI, POICategory, GPXFile } from '@trailx/shared'
import { POI_CATEGORIES } from '@trailx/shared'

// Re-assigns order and type to every point based on array position.
function assignTypes(points: RoutePoint[]): RoutePoint[] {
  const last = points.length - 1
  return points.map((p, i) => ({
    ...p,
    order: i,
    type: i === 0 ? 'start' : i === last ? 'end' : 'intermediate',
  }))
}

/** Return up to `count` evenly spaced indices from [0, length-1] inclusive */
function sampleIndices(length: number, count: number): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i)
  return Array.from({ length: count }, (_, i) =>
    Math.round((i * (length - 1)) / (count - 1)),
  )
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
  setSearchOpen: (open: boolean) => void
  setExportOpen: (open: boolean) => void
  // POI
  setPois: (pois: POI[]) => void
  setIsSearchingPOI: (value: boolean) => void
  toggleCategory: (category: POICategory) => void
  setActiveCategories: (categories: POICategory[]) => void
  // POI card
  setSelectedPOI: (poi: POI | null) => void
  addStandalonePoi: (poi: POI) => void
  // GPX import
  loadRouteFromGPX: (gpxFile: GPXFile) => void
}

interface MapStore {
  waypoints: RoutePoint[]
  activeRouteId: string | null
  routeResult: RouteResult | null
  isRouting: boolean
  profile: RoutingProfile
  routeError: string | null
  isSearchOpen: boolean
  isExportOpen: boolean
  // POI search
  pois: POI[]
  isSearchingPOI: boolean
  activeCategories: POICategory[]
  // POI card
  selectedPOI: POI | null
  standalonePois: POI[]
  actions: MapStoreActions
}

export const useMapStore = create<MapStore>((set) => ({
  waypoints: [],
  activeRouteId: null,
  routeResult: null,
  isRouting: false,
  profile: 'bike',
  routeError: null,
  isSearchOpen: false,
  isExportOpen: false,
  pois: [],
  isSearchingPOI: false,
  activeCategories: [...POI_CATEGORIES],
  selectedPOI: null,
  standalonePois: [],

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

    setSearchOpen: (open) => set({ isSearchOpen: open }),

    setExportOpen: (open) => set({ isExportOpen: open }),

    setPois: (pois) => set({ pois }),

    setIsSearchingPOI: (value) => set({ isSearchingPOI: value }),

    toggleCategory: (category) =>
      set((state) => ({
        activeCategories: state.activeCategories.includes(category)
          ? state.activeCategories.filter((c) => c !== category)
          : [...state.activeCategories, category],
      })),

    setActiveCategories: (categories) => set({ activeCategories: categories }),

    setSelectedPOI: (poi) => set({ selectedPOI: poi }),

    addStandalonePoi: (poi) =>
      set((state) => ({
        standalonePois: [...state.standalonePois, poi],
      })),

    loadRouteFromGPX: (gpxFile) =>
      set((state) => {
        // GPX <wpt> elements become standalone POIs
        const newStandalonePois: POI[] = gpxFile.waypoints.map((wpt) => ({
          id: crypto.randomUUID(),
          lat: wpt.lat,
          lng: wpt.lng,
          name: wpt.name,
          category: 'viewpoint' as const,
          tags: {},
          osmId: 0,
          osmType: 'node' as const,
        }))

        const firstTrack = gpxFile.tracks[0]
        if (!firstTrack || firstTrack.points.length === 0) {
          return { ...state, standalonePois: newStandalonePois }
        }

        // Sample up to 5 key points (start + intermediates + end)
        const indices = sampleIndices(firstTrack.points.length, 5)
        const newWaypoints = assignTypes(
          indices.map((idx) => {
            const pt = firstTrack.points[idx]
            return {
              id: crypto.randomUUID(),
              lat: pt.lat,
              lng: pt.lng,
              order: 0,
              type: 'start' as const,
            }
          }),
        )

        return {
          waypoints: newWaypoints,
          routeResult: null,
          standalonePois: newStandalonePois,
        }
      }),
  },
}))
