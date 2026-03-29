import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPOIsAlongRoute, OverpassTimeoutError, detectCategory } from './overpass'
import type { POICategory } from '@trailx/shared'

const ROUTE_GEOMETRY = {
  type: 'LineString' as const,
  // [lng, lat] pairs — route goes roughly NE
  coordinates: [
    [30.52, 50.45],
    [30.57, 50.50],
    [30.62, 50.55],
  ],
}

// POI directly on the route segment — always within any reasonable buffer
const DRINKING_WATER_ELEMENT = {
  type: 'node' as const,
  id: 1001,
  lat: 50.47,
  lon: 30.54,
  tags: { amenity: 'drinking_water', name: 'Fountain A' },
}

const FOOD_ELEMENT = {
  type: 'node' as const,
  id: 1002,
  lat: 50.48,
  lon: 30.55,
  tags: { amenity: 'cafe', name: 'Café B' },
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(status: number, body: unknown) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  }
  vi.mocked(fetch).mockResolvedValue(response as unknown as Response)
}

describe('detectCategory', () => {
  it('maps amenity=drinking_water', () => {
    expect(detectCategory({ amenity: 'drinking_water' })).toBe('drinking_water')
  })
  it('maps amenity=bicycle_repair_station', () => {
    expect(detectCategory({ amenity: 'bicycle_repair_station' })).toBe('bicycle_repair')
  })
  it('maps amenity=cafe', () => {
    expect(detectCategory({ amenity: 'cafe' })).toBe('food')
  })
  it('maps tourism=viewpoint', () => {
    expect(detectCategory({ tourism: 'viewpoint' })).toBe('viewpoint')
  })
  it('returns null for unknown tags', () => {
    expect(detectCategory({ random: 'tag' })).toBeNull()
  })
})

describe('fetchPOIsAlongRoute', () => {
  it('returns empty array when categories is empty', async () => {
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, [])
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns mapped POIs on success', async () => {
    mockFetch(200, { elements: [DRINKING_WATER_ELEMENT, FOOD_ELEMENT] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water', 'food'])
    expect(result.length).toBeGreaterThanOrEqual(2)
    const water = result.find((p) => p.category === 'drinking_water')
    expect(water?.name).toBe('Fountain A')
    expect(water?.lat).toBe(50.47)
    expect(water?.lng).toBe(30.54)
    expect(water?.osmId).toBe(1001)
    expect(water?.osmType).toBe('node')
    expect(water?.id).toBe('osm-node-1001')
  })

  it('filters out elements whose tags do not match any category', async () => {
    const unknownElement = {
      type: 'node' as const,
      id: 999,
      lat: 50.47,
      lon: 30.54,
      tags: { random: 'tag' },
    }
    mockFetch(200, { elements: [unknownElement] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])
    expect(result).toHaveLength(0)
  })

  it('handles way elements via center coordinates', async () => {
    // New behaviour: nwr query returns ways with center coords
    const wayElement = {
      type: 'way' as const,
      id: 500,
      center: { lat: 50.47, lon: 30.54 },
      tags: { amenity: 'cafe' },
    }
    mockFetch(200, { elements: [wayElement] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['food'])
    expect(result).toHaveLength(1)
    expect(result[0].osmType).toBe('way')
  })

  it('filters out POIs whose detected category is not in requested categories', async () => {
    // cafe → food, but we only request 'shelter'
    mockFetch(200, { elements: [FOOD_ELEMENT] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['shelter' as POICategory])
    expect(result).toHaveLength(0)
  })

  it('filters out POIs that are far from the route', async () => {
    // POI 100km away from route
    const farElement = {
      type: 'node' as const,
      id: 9999,
      lat: 60.0,
      lon: 40.0,
      tags: { amenity: 'drinking_water' },
    }
    mockFetch(200, { elements: [farElement] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])
    expect(result).toHaveLength(0)
  })

  it('throws OverpassTimeoutError on abort', async () => {
    vi.mocked(fetch).mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
    await expect(
      fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water']),
    ).rejects.toBeInstanceOf(OverpassTimeoutError)
  })

  it('returns empty array on network error (graceful degradation)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network failure'))
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])
    expect(result).toEqual([])
  })

  it('returns empty array when response is not ok (graceful degradation)', async () => {
    mockFetch(503, {})
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])
    expect(result).toEqual([])
  })

  it('handles elements with no tags gracefully', async () => {
    const noTagsEl = { type: 'node' as const, id: 777, lat: 50.47, lon: 30.54 }
    mockFetch(200, { elements: [noTagsEl] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])
    expect(result).toHaveLength(0)
  })

  it('deduplicates POIs that appear in multiple tiles', async () => {
    // Same element returned from every tile fetch (tiles overlap)
    mockFetch(200, { elements: [DRINKING_WATER_ELEMENT] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])
    const ids = result.map((p) => p.id)
    const unique = new Set(ids)
    expect(ids.length).toBe(unique.size)
  })
})
