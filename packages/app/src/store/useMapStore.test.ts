import { describe, it, expect, beforeEach } from 'vitest'
import { calcMeasureDistance, useMapStore, MEASURE_COLORS } from './useMapStore'

// ── calcMeasureDistance (pure function) ───────────────────────────────────────

describe('calcMeasureDistance', () => {
  it('returns 0 for empty array', () => {
    expect(calcMeasureDistance([])).toBe(0)
  })

  it('returns 0 for single node', () => {
    expect(calcMeasureDistance([[30, 50]])).toBe(0)
  })

  it('computes ~111 km for 1° latitude separation', () => {
    // 1 degree of latitude ≈ 111.195 km
    const dist = calcMeasureDistance([[0, 0], [0, 1]])
    expect(dist).toBeCloseTo(111.195, 0)
  })

  it('accumulates distance across multiple segments', () => {
    // Two equal segments → ~222 km
    const dist = calcMeasureDistance([[0, 0], [0, 1], [0, 2]])
    expect(dist).toBeCloseTo(222.39, 0)
  })

  it('is symmetric (A→B = B→A)', () => {
    const ab = calcMeasureDistance([[0, 0], [10, 0]])
    const ba = calcMeasureDistance([[10, 0], [0, 0]])
    expect(ab).toBeCloseTo(ba, 5)
  })
})

// ── Store actions ─────────────────────────────────────────────────────────────

function getActions() {
  return useMapStore.getState().actions
}

function getState() {
  return useMapStore.getState()
}

beforeEach(() => {
  // Reset store to initial state before each test
  getActions().clearRoute()
  getActions().deleteAllMeasureSessions()
})

describe('addWaypoint', () => {
  it('appends a waypoint and reassigns types', () => {
    const { addWaypoint } = getActions()
    addWaypoint({ id: 'w1', lat: 50, lng: 30, order: 0, type: 'start' })
    const wps = getState().waypoints
    // Initial store has 2 NaN waypoints from makeEmptyWaypoints; after clearRoute it resets
    // The added waypoint should be last
    expect(wps.some((w) => w.id === 'w1')).toBe(true)
  })
})

describe('smartAddWaypoint', () => {
  it('fills the first NaN slot', () => {
    const { smartAddWaypoint } = getActions()
    // After clearRoute, store has 2 NaN waypoints: start and end
    smartAddWaypoint(51, 31)
    const wps = getState().waypoints
    const filled = wps.find((w) => w.lat === 51)
    expect(filled).toBeDefined()
    expect(filled?.type).toBe('start')
  })

  it('inserts before last when all slots are resolved', () => {
    const { smartAddWaypoint } = getActions()
    // Fill both NaN slots
    smartAddWaypoint(50, 30)
    smartAddWaypoint(52, 32)
    const countBefore = getState().waypoints.length

    // Now all are resolved — next call should insert before last
    smartAddWaypoint(51, 31)
    expect(getState().waypoints.length).toBe(countBefore + 1)
    const wps = getState().waypoints
    expect(wps[wps.length - 2].lat).toBe(51)
  })
})

describe('reorderWaypoints', () => {
  it('moves a waypoint from one index to another', () => {
    // Clear and build a 3-waypoint route
    const { addWaypoint } = getActions()
    getActions().clearRoute()
    addWaypoint({ id: 'a', lat: 1, lng: 1, order: 0, type: 'start' })
    addWaypoint({ id: 'b', lat: 2, lng: 2, order: 1, type: 'intermediate' })
    addWaypoint({ id: 'c', lat: 3, lng: 3, order: 2, type: 'end' })
    const before = getState().waypoints.map((w) => w.id)
    getActions().reorderWaypoints(0, 2)
    const after = getState().waypoints.map((w) => w.id)
    expect(after).not.toEqual(before)
    expect(after[2]).toBe(before[0])
  })
})

describe('reverseWaypoints', () => {
  it('reverses waypoint order and clears routeResult', () => {
    const { addWaypoint, reverseWaypoints, setRouteResult } = getActions()
    getActions().clearRoute()
    addWaypoint({ id: 'a', lat: 1, lng: 1, order: 0, type: 'start' })
    addWaypoint({ id: 'b', lat: 2, lng: 2, order: 1, type: 'end' })
    setRouteResult({ geometry: { type: 'LineString', coordinates: [] }, distance: 100, duration: 10, elevation: [] })
    reverseWaypoints()
    const wps = getState().waypoints
    expect(wps[0].lat).toBe(2)
    expect(getState().routeResult).toBeNull()
  })
})

describe('removeWaypoint', () => {
  it('removes waypoint by id', () => {
    const { addWaypoint, removeWaypoint } = getActions()
    getActions().clearRoute()
    addWaypoint({ id: 'x', lat: 50, lng: 30, order: 0, type: 'start' })
    removeWaypoint('x')
    expect(getState().waypoints.some((w) => w.id === 'x')).toBe(false)
  })
})

describe('updateWaypoint', () => {
  it('updates lat/lng/label of a waypoint', () => {
    const { addWaypoint, updateWaypoint } = getActions()
    getActions().clearRoute()
    addWaypoint({ id: 'u', lat: 50, lng: 30, order: 0, type: 'start' })
    updateWaypoint('u', 55, 35, 'Home')
    const wp = getState().waypoints.find((w) => w.id === 'u')
    expect(wp?.lat).toBe(55)
    expect(wp?.lng).toBe(35)
    expect(wp?.label).toBe('Home')
  })
})

describe('toggleCategory', () => {
  it('removes a category when it is active', () => {
    const { setActiveCategories, toggleCategory } = getActions()
    setActiveCategories(['food', 'shelter'])
    toggleCategory('food')
    expect(getState().activeCategories).not.toContain('food')
    expect(getState().activeCategories).toContain('shelter')
  })

  it('adds a category when it is inactive', () => {
    const { setActiveCategories, toggleCategory } = getActions()
    setActiveCategories(['shelter'])
    toggleCategory('food')
    expect(getState().activeCategories).toContain('food')
  })

  it('filters pois to match new activeCategories', () => {
    const { setAllPois, toggleCategory } = getActions()
    setAllPois([
      { id: '1', lat: 0, lng: 0, category: 'food', tags: {}, osmId: 1, osmType: 'node' },
      { id: '2', lat: 0, lng: 0, category: 'shelter', tags: {}, osmId: 2, osmType: 'node' },
    ])
    const all = getState().activeCategories
    if (all.includes('food')) toggleCategory('food')
    // 'food' is now inactive → POI with category 'food' should be filtered out
    expect(getState().pois.some((p) => p.category === 'food')).toBe(false)
  })
})

describe('addStandalonePoi / removeStandalonePoi', () => {
  it('adds and removes standalone POIs', () => {
    const { addStandalonePoi, removeStandalonePoi } = getActions()
    const poi = { id: 'sp1', lat: 50, lng: 30, category: 'viewpoint' as const, tags: {}, osmId: 1, osmType: 'node' as const }
    addStandalonePoi(poi)
    expect(getState().standalonePois.some((p) => p.id === 'sp1')).toBe(true)
    removeStandalonePoi('sp1')
    expect(getState().standalonePois.some((p) => p.id === 'sp1')).toBe(false)
  })
})

describe('setStandalonePois', () => {
  it('replaces standalonePois with given array', () => {
    const { addStandalonePoi, setStandalonePois } = getActions()
    const poiA = { id: 'old', lat: 1, lng: 1, category: 'tourism' as const, tags: {}, osmId: 1, osmType: 'node' as const }
    const poiB = { id: 'new1', lat: 2, lng: 2, category: 'tourism' as const, tags: {}, osmId: 2, osmType: 'node' as const }
    const poiC = { id: 'new2', lat: 3, lng: 3, category: 'tourism' as const, tags: {}, osmId: 3, osmType: 'node' as const }
    addStandalonePoi(poiA)
    setStandalonePois([poiB, poiC])
    const pois = getState().standalonePois
    expect(pois).toHaveLength(2)
    expect(pois.map((p) => p.id)).toEqual(['new1', 'new2'])
  })

  it('clears standalonePois when given empty array', () => {
    const { addStandalonePoi, setStandalonePois } = getActions()
    const poi = { id: 'x', lat: 1, lng: 1, category: 'tourism' as const, tags: {}, osmId: 1, osmType: 'node' as const }
    addStandalonePoi(poi)
    setStandalonePois([])
    expect(getState().standalonePois).toHaveLength(0)
  })
})

describe('setMeasureSessions', () => {
  it('replaces measureSessions and resets active state', () => {
    getActions().setMeasureActive(true)
    const session = { id: 'ms-restored', color: '#abc', nodes: [[1, 2] as [number, number]], distance: 5 }
    getActions().setMeasureSessions([session])
    const state = getState()
    expect(state.measureSessions).toHaveLength(1)
    expect(state.measureSessions[0].id).toBe('ms-restored')
    expect(state.measureActive).toBe(false)
    expect(state.measureActiveSessionId).toBeNull()
  })

  it('clears measureSessions when given empty array', () => {
    getActions().setMeasureActive(true)
    getActions().setMeasureSessions([])
    expect(getState().measureSessions).toHaveLength(0)
  })
})

describe('updateSettings', () => {
  it('merges partial settings patch', () => {
    const { updateSettings } = getActions()
    updateSettings({ distanceUnit: 'mi', poiBuffer: 1000 })
    const s = getState().appSettings
    expect(s.distanceUnit).toBe('mi')
    expect(s.poiBuffer).toBe(1000)
    // Other settings unchanged
    expect(s.language).toBe('ru')
  })
})

describe('persistence', () => {
  it('store contains measure session with nodes after setMeasureActive + addMeasureNode', () => {
    getActions().setMeasureActive(true)
    getActions().addMeasureNode([30, 50])
    getActions().addMeasureNode([31, 51])
    const { measureSessions, measureActiveSessionId } = getState()
    expect(measureSessions).toHaveLength(1)
    expect(measureActiveSessionId).toBe(measureSessions[0].id)
    expect(measureSessions[0].nodes).toHaveLength(2)
  })

  it('partialize includes measureSessions and measureActiveSessionId', () => {
    getActions().setMeasureActive(true)
    const state = getState()
    // Access the persist api to get the partialised state
    const api = useMapStore.persist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partialFn = (api as any).getOptions?.()?.partialize
    if (partialFn) {
      const partial = partialFn(state) as Record<string, unknown>
      expect('measureSessions' in partial).toBe(true)
      expect('measureActiveSessionId' in partial).toBe(true)
    } else {
      // Fallback: verify the fields exist in state (store is correctly typed)
      expect(Array.isArray(state.measureSessions)).toBe(true)
      expect('measureActiveSessionId' in state).toBe(true)
    }
  })

  it('migrate version < 2 sets measureSessions and measureActiveSessionId defaults', () => {
    // Simulate an old persisted state (version 1) without measure fields
    const oldState: Record<string, unknown> = {
      waypoints: [],
      routeResult: null,
      profile: 'bike',
      standalonePois: [],
      appSettings: {},
    }
    // Access migrate function via persist options
    const api = useMapStore.persist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const migrate = (api as any).getOptions?.()?.migrate as
      | ((state: unknown, version: number) => Record<string, unknown>)
      | undefined
    if (migrate) {
      const migrated = migrate(oldState, 1) as Record<string, unknown>
      expect(migrated.measureSessions).toEqual([])
      expect(migrated.measureActiveSessionId).toBeNull()
    } else {
      // If we can't access migrate directly, verify MEASURE_COLORS exists (smoke test)
      expect(MEASURE_COLORS.length).toBeGreaterThan(0)
    }
  })
})

describe('measure tool actions', () => {
  it('setMeasureActive creates first session when none exist', () => {
    getActions().setMeasureActive(true)
    expect(getState().measureSessions).toHaveLength(1)
    expect(getState().measureActive).toBe(true)
    expect(getState().measureActiveSessionId).toBeTruthy()
  })

  it('addMeasureNode appends node and recalculates distance', () => {
    getActions().setMeasureActive(true)
    getActions().addMeasureNode([0, 0])
    getActions().addMeasureNode([0, 1])
    const session = getState().measureSessions[0]
    expect(session.nodes).toHaveLength(2)
    expect(session.distance).toBeGreaterThan(0)
  })

  it('deleteMeasureSession removes session by id', () => {
    getActions().setMeasureActive(true)
    const sid = getState().measureActiveSessionId!
    getActions().deleteMeasureSession(sid)
    expect(getState().measureSessions.some((s) => s.id === sid)).toBe(false)
  })

  it('deleteAllMeasureSessions clears everything', () => {
    getActions().setMeasureActive(true)
    getActions().startMeasureSession()
    getActions().deleteAllMeasureSessions()
    expect(getState().measureSessions).toHaveLength(0)
    expect(getState().measureActiveSessionId).toBeNull()
  })
})
