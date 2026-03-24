import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRoute } from './useRoute'
import { useMapStore } from '../store/useMapStore'

// Reset store before each test
beforeEach(() => {
  useMapStore.setState(useMapStore.getInitialState())
})

// Stable UUID for deterministic tests
vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-uuid') })

describe('useRoute', () => {
  it('returns empty waypoints on init (just start + end placeholders)', () => {
    const { result } = renderHook(() => useRoute())
    // The store initialises with 2 empty waypoints (start + end)
    expect(result.current.waypoints).toHaveLength(2)
  })

  it('addWaypoint adds a waypoint to the store', () => {
    const { result } = renderHook(() => useRoute())
    act(() => { result.current.addWaypoint(52.1, 23.5, 'Park') })
    expect(result.current.waypoints.some((w) => w.lat === 52.1)).toBe(true)
  })

  it('addWaypoint uses crypto.randomUUID for id', () => {
    const { result } = renderHook(() => useRoute())
    act(() => { result.current.addWaypoint(52.1, 23.5) })
    expect(result.current.waypoints.some((w) => w.id === 'test-uuid')).toBe(true)
  })

  it('removeWaypoint removes the waypoint by id', () => {
    const { result } = renderHook(() => useRoute())
    act(() => { result.current.addWaypoint(52.1, 23.5, 'Point') })
    const added = result.current.waypoints.find((w) => w.id === 'test-uuid')
    expect(added).toBeDefined()

    act(() => { result.current.removeWaypoint('test-uuid') })
    expect(result.current.waypoints.find((w) => w.id === 'test-uuid')).toBeUndefined()
  })

  it('reorderWaypoints swaps two waypoints', () => {
    const { result } = renderHook(() => useRoute())
    const initialOrder = result.current.waypoints.map((w) => w.id)

    act(() => { result.current.reorderWaypoints(0, 1) })
    const newOrder = result.current.waypoints.map((w) => w.id)
    expect(newOrder[0]).toBe(initialOrder[1])
    expect(newOrder[1]).toBe(initialOrder[0])
  })

  it('clearRoute resets waypoints to start + end placeholders', () => {
    const { result } = renderHook(() => useRoute())
    act(() => { result.current.addWaypoint(52.1, 23.5, 'Midpoint') })

    act(() => { result.current.clearRoute() })
    expect(result.current.waypoints).toHaveLength(2)
    expect(result.current.waypoints.every((w) => isNaN(w.lat))).toBe(true)
  })
})
