import { create } from 'zustand'
import type { RoutePoint, RouteResult, RoutingProfile, POI, POICategory, GPXFile } from '@trailx/shared'
import { POI_CATEGORIES } from '@trailx/shared'

// ── Measure tool ─────────────────────────────────────────────────────────────
export interface MeasureSession {
  id: string
  nodes: [number, number][] // [lng, lat]
  distance: number          // km
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function calcMeasureDistance(nodes: [number, number][]): number {
  let d = 0
  for (let i = 1; i < nodes.length; i++) d += haversineKm(nodes[i - 1], nodes[i])
  return d
}

export interface AppSettings {
  language: 'ru' | 'en'
  distanceUnit: 'km' | 'mi'
  gpxExport: { includeTrk: boolean; includeRte: boolean; includeWpt: boolean }
  poiBuffer: number
  mapStyle: 'liberty' | 'bright' | 'positron'
  showPois: boolean
  speeds: { foot: number; bike: number; mtb: number; racingbike: number }
  foot: { preferFootpaths: boolean; avoidRoads: boolean }
  bike: { routeType: 'fastest' | 'safest' | 'short'; avoidHighways: boolean }
  mtb: { difficulty: 'low' | 'medium' | 'high'; avoidPaved: boolean }
  racingbike: { routeType: 'fastest' | 'short'; avoidCobblestones: boolean }
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'ru',
  distanceUnit: 'km',
  gpxExport: { includeTrk: true, includeRte: false, includeWpt: true },
  poiBuffer: 500,
  mapStyle: 'liberty',
  showPois: true,
  speeds: { foot: 5, bike: 20, mtb: 15, racingbike: 28 },
  foot: { preferFootpaths: true, avoidRoads: false },
  bike: { routeType: 'fastest', avoidHighways: false },
  mtb: { difficulty: 'medium', avoidPaved: false },
  racingbike: { routeType: 'fastest', avoidCobblestones: true },
}

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
  smartAddWaypoint: (lat: number, lng: number) => void
  insertWaypointNear: (lat: number, lng: number, label?: string) => void
  updateWaypoint: (id: string, lat: number, lng: number, label?: string) => void
  addEmptyIntermediate: () => void
  addIntermediateAt: (lat: number, lng: number) => void
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
  setAllPois: (pois: POI[]) => void
  setPois: (pois: POI[]) => void
  setIsSearchingPOI: (value: boolean) => void
  toggleCategory: (category: POICategory) => void
  setActiveCategories: (categories: POICategory[]) => void
  // POI card
  setSelectedPOI: (poi: POI | null) => void
  addStandalonePoi: (poi: POI) => void
  removeStandalonePoi: (id: string) => void
  // GPX import
  loadRouteFromGPX: (gpxFile: GPXFile) => void
  // Settings
  updateSettings: (patch: Partial<AppSettings>) => void
  // Measure tool
  setMeasureActive: (v: boolean) => void
  addMeasureNode: (coord: [number, number]) => void
  removeMeasureNode: (sessionId: string, nodeIndex: number) => void
  startMeasureSession: () => void
  deleteMeasureSession: (id: string) => void
  deleteAllMeasureSessions: () => void
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
  allPois: POI[]        // all fetched POIs (unfiltered)
  pois: POI[]           // filtered by activeCategories — derived, kept in sync
  isSearchingPOI: boolean
  activeCategories: POICategory[]
  // POI card
  selectedPOI: POI | null
  standalonePois: POI[]
  // App settings
  appSettings: AppSettings
  // Measure tool
  measureActive: boolean
  measureSessions: MeasureSession[]
  measureActiveSessionId: string | null
  actions: MapStoreActions
}

/** Squared distance from point P to segment AB */
function sqDistToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
}

function makeEmptyWaypoints(): RoutePoint[] {
  return [
    { id: crypto.randomUUID(), lat: NaN, lng: NaN, order: 0, type: 'start' },
    { id: crypto.randomUUID(), lat: NaN, lng: NaN, order: 1, type: 'end' },
  ]
}

export const useMapStore = create<MapStore>((set) => ({
  waypoints: makeEmptyWaypoints(),
  activeRouteId: null,
  routeResult: null,
  isRouting: false,
  profile: 'bike',
  routeError: null,
  isSearchOpen: false,
  isExportOpen: false,
  allPois: [],
  pois: [],
  isSearchingPOI: false,
  activeCategories: [...POI_CATEGORIES],
  selectedPOI: null,
  standalonePois: [],
  appSettings: DEFAULT_SETTINGS,
  measureActive: false,
  measureSessions: [],
  measureActiveSessionId: null,

  actions: {
    addWaypoint: (point) =>
      set((state) => ({
        waypoints: assignTypes([...state.waypoints, point]),
      })),

    // Fills the first unresolved (NaN) slot, or inserts before last if all resolved
    smartAddWaypoint: (lat, lng) =>
      set((state) => {
        const nanIdx = state.waypoints.findIndex((p) => isNaN(p.lat))
        if (nanIdx !== -1) {
          return {
            waypoints: state.waypoints.map((p, i) =>
              i === nanIdx ? { ...p, lat, lng } : p,
            ),
          }
        }
        const items = [...state.waypoints]
        const newPoint: RoutePoint = {
          id: crypto.randomUUID(), lat, lng, order: 0, type: 'intermediate',
        }
        items.splice(items.length - 1, 0, newPoint)
        return { waypoints: assignTypes(items) }
      }),

    insertWaypointNear: (lat, lng, label) =>
      set((state) => {
        const resolved = state.waypoints
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => !isNaN(p.lat))
        if (resolved.length < 2) {
          // Fallback: fill first NaN slot or append before last
          const nanIdx = state.waypoints.findIndex((p) => isNaN(p.lat))
          if (nanIdx !== -1) {
            return {
              waypoints: state.waypoints.map((p, i) =>
                i === nanIdx ? { ...p, lat, lng, label } : p,
              ),
            }
          }
          const items = [...state.waypoints]
          items.splice(items.length - 1, 0, {
            id: crypto.randomUUID(), lat, lng, label, order: 0, type: 'intermediate',
          })
          return { waypoints: assignTypes(items) }
        }
        // Find the segment with minimum distance from the POI
        let bestAfterIdx = resolved[resolved.length - 2].i
        let bestDist = Infinity
        for (let k = 0; k < resolved.length - 1; k++) {
          const a = resolved[k].p
          const b = resolved[k + 1].p
          const d = sqDistToSegment(lng, lat, a.lng, a.lat, b.lng, b.lat)
          if (d < bestDist) {
            bestDist = d
            bestAfterIdx = resolved[k].i
          }
        }
        const items = [...state.waypoints]
        items.splice(bestAfterIdx + 1, 0, {
          id: crypto.randomUUID(), lat, lng, label, order: 0, type: 'intermediate',
        })
        return { waypoints: assignTypes(items) }
      }),

    updateWaypoint: (id, lat, lng, label) =>
      set((state) => ({
        waypoints: state.waypoints.map((p) =>
          p.id === id ? { ...p, lat, lng, label } : p,
        ),
      })),

    addEmptyIntermediate: () =>
      set((state) => {
        const items = [...state.waypoints]
        const newPoint: RoutePoint = {
          id: crypto.randomUUID(), lat: NaN, lng: NaN, order: 0, type: 'intermediate',
        }
        items.splice(items.length - 1, 0, newPoint)
        return { waypoints: assignTypes(items) }
      }),

    addIntermediateAt: (lat, lng) =>
      set((state) => {
        const items = [...state.waypoints]
        items.splice(items.length - 1, 0, {
          id: crypto.randomUUID(), lat, lng, order: 0, type: 'intermediate',
        })
        return { waypoints: assignTypes(items) }
      }),

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

    clearRoute: () => set({ waypoints: makeEmptyWaypoints(), routeResult: null, routeError: null }),

    setRouteResult: (result) => set({ routeResult: result }),

    setIsRouting: (value) => set({ isRouting: value }),

    setProfile: (profile) => set({ profile }),

    setRouteError: (err) => set({ routeError: err }),

    setSearchOpen: (open) => set({ isSearchOpen: open }),

    setExportOpen: (open) => set({ isExportOpen: open }),

    setAllPois: (pois) =>
      set((state) => ({
        allPois: pois,
        pois: pois.filter((p) => state.activeCategories.includes(p.category)),
      })),

    setPois: (pois) => set({ pois }),

    setIsSearchingPOI: (value) => set({ isSearchingPOI: value }),

    toggleCategory: (category) =>
      set((state) => {
        const next = state.activeCategories.includes(category)
          ? state.activeCategories.filter((c) => c !== category)
          : [...state.activeCategories, category]
        return {
          activeCategories: next,
          pois: state.allPois.filter((p) => next.includes(p.category)),
        }
      }),

    setActiveCategories: (categories) =>
      set((state) => ({
        activeCategories: categories,
        pois: state.allPois.filter((p) => categories.includes(p.category)),
      })),

    setSelectedPOI: (poi) => set({ selectedPOI: poi }),

    addStandalonePoi: (poi) =>
      set((state) => ({
        standalonePois: [...state.standalonePois, poi],
      })),

    removeStandalonePoi: (id) =>
      set((state) => ({
        standalonePois: state.standalonePois.filter((p) => p.id !== id),
      })),

    updateSettings: (patch) =>
      set((state) => ({ appSettings: { ...state.appSettings, ...patch } })),

    setMeasureActive: (v) =>
      set((state) => {
        if (v && state.measureSessions.length === 0) {
          const id = crypto.randomUUID()
          return { measureActive: true, measureSessions: [{ id, nodes: [], distance: 0 }], measureActiveSessionId: id }
        }
        return { measureActive: v }
      }),

    addMeasureNode: (coord) =>
      set((state) => {
        const sid = state.measureActiveSessionId
        if (!sid) return state
        return {
          measureSessions: state.measureSessions.map((s) => {
            if (s.id !== sid) return s
            const nodes = [...s.nodes, coord] as [number, number][]
            return { ...s, nodes, distance: calcMeasureDistance(nodes) }
          }),
        }
      }),

    removeMeasureNode: (sessionId, nodeIndex) =>
      set((state) => ({
        measureSessions: state.measureSessions.map((s) => {
          if (s.id !== sessionId) return s
          const nodes = s.nodes.filter((_, i) => i !== nodeIndex) as [number, number][]
          return { ...s, nodes, distance: calcMeasureDistance(nodes) }
        }),
      })),

    startMeasureSession: () =>
      set((state) => {
        const id = crypto.randomUUID()
        return {
          measureSessions: [...state.measureSessions, { id, nodes: [], distance: 0 }],
          measureActiveSessionId: id,
        }
      }),

    deleteMeasureSession: (id) =>
      set((state) => {
        const next = state.measureSessions.filter((s) => s.id !== id)
        const activeId = state.measureActiveSessionId === id
          ? (next.length > 0 ? next[next.length - 1].id : null)
          : state.measureActiveSessionId
        return { measureSessions: next, measureActiveSessionId: activeId }
      }),

    deleteAllMeasureSessions: () =>
      set({ measureSessions: [], measureActiveSessionId: null }),

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
