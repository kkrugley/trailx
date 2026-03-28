import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPOIsAlongRoute, OverpassTimeoutError, OverpassAllServersFailedError } from './overpass'
import type { POICategory } from '@trailx/shared'

const ROUTE_GEOMETRY = {
  type: 'LineString' as const,
  // [lng, lat] pairs
  coordinates: [
    [30.52, 50.45],
    [30.57, 50.50],
    [30.62, 50.55],
  ],
}

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

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
  let call = 0
  vi.mocked(fetch).mockImplementation(() => {
    const r = responses[Math.min(call, responses.length - 1)]
    call++
    const response = {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: vi.fn().mockResolvedValue(r.body),
    }
    return Promise.resolve(response as unknown as Response)
  })
}

describe('fetchPOIsAlongRoute', () => {
  it('returns empty array when categories is empty', async () => {
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, [])
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns mapped POIs on success', async () => {
    mockFetch(200, { elements: [DRINKING_WATER_ELEMENT, FOOD_ELEMENT] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water', 'food'])
    expect(result).toHaveLength(2)
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
      lat: 50.49,
      lon: 30.56,
      tags: { random: 'tag' },
    }
    mockFetch(200, { elements: [unknownElement] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])
    expect(result).toHaveLength(0)
  })

  it('filters out non-node elements (way/relation)', async () => {
    const wayElement = { type: 'way' as const, id: 500, lat: 50.47, lon: 30.54, tags: { amenity: 'cafe' } }
    mockFetch(200, { elements: [wayElement] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['food'])
    expect(result).toHaveLength(0)
  })

  it('filters out POIs whose detected category is not in requested categories', async () => {
    // cafe → food, but we only request 'shelter'
    mockFetch(200, { elements: [FOOD_ELEMENT] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['shelter' as POICategory])
    expect(result).toHaveLength(0)
  })

  it('throws OverpassAllServersFailedError when internal timeout fires on all servers', async () => {
    // Without an external signal, AbortError means the internal timeout fired → rotate
    // After all 3 servers exhaust retries, OverpassAllServersFailedError is thrown
    vi.mocked(fetch).mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
    await expect(
      fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water']),
    ).rejects.toBeInstanceOf(OverpassAllServersFailedError)
  })

  it('re-throws non-abort errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network failure'))
    await expect(
      fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water']),
    ).rejects.toThrow('Network failure')
  })

  it('handles elements with no tags gracefully', async () => {
    const noTagsEl = { type: 'node' as const, id: 777, lat: 50.47, lon: 30.54 }
    mockFetch(200, { elements: [noTagsEl] })
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])
    expect(result).toHaveLength(0)
  })
})

describe('fetchPOIsAlongRoute — multi-server failover', () => {
  it('rotates to second server when first returns 429 and succeeds', async () => {
    mockFetchSequence([
      { status: 429, body: {} },
      { status: 200, body: { elements: [DRINKING_WATER_ELEMENT] } },
    ])
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])
    expect(result).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('rotates to second server when first returns 503 and succeeds', async () => {
    mockFetchSequence([
      { status: 503, body: {} },
      { status: 200, body: { elements: [FOOD_ELEMENT] } },
    ])
    const result = await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['food'])
    expect(result).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('throws OverpassAllServersFailedError when all 3 servers fail with 503', async () => {
    mockFetchSequence([
      { status: 503, body: {} },
      { status: 503, body: {} },
      { status: 503, body: {} },
    ])
    await expect(
      fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water']),
    ).rejects.toBeInstanceOf(OverpassAllServersFailedError)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('throws OverpassAllServersFailedError when all 3 servers fail with 429', async () => {
    mockFetchSequence([
      { status: 429, body: {} },
      { status: 429, body: {} },
      { status: 429, body: {} },
    ])
    await expect(
      fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water']),
    ).rejects.toBeInstanceOf(OverpassAllServersFailedError)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('stops retries immediately when abort signal is triggered', async () => {
    const abortController = new AbortController()

    vi.mocked(fetch).mockImplementation(() => {
      // Abort after first call
      abortController.abort()
      const response = {
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({}),
      }
      return Promise.resolve(response as unknown as Response)
    })

    await expect(
      fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'], abortController.signal),
    ).rejects.toBeInstanceOf(OverpassTimeoutError)
    // Should have called fetch once then aborted, not retried
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('throws OverpassTimeoutError when external abort signal is pre-aborted', async () => {
    const abortController = new AbortController()
    abortController.abort()

    await expect(
      fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'], abortController.signal),
    ).rejects.toBeInstanceOf(OverpassTimeoutError)
    // Should not call fetch at all
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('nextServer round-robin', () => {
  it('cycles through all three servers across sequential calls', async () => {
    // Use a fresh sequence to observe URL rotation across calls
    const capturedUrls: string[] = []
    vi.mocked(fetch).mockImplementation((url) => {
      capturedUrls.push(url as string)
      const response = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ elements: [] }),
      }
      return Promise.resolve(response as unknown as Response)
    })

    // Make 3 separate successful calls
    await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])
    await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])
    await fetchPOIsAlongRoute(ROUTE_GEOMETRY, 500, ['drinking_water'])

    expect(capturedUrls).toHaveLength(3)
    // All three should be distinct Overpass server URLs
    const servers = new Set(capturedUrls)
    expect(servers.size).toBe(3)
    expect(capturedUrls.some((u) => u.includes('overpass-api.de'))).toBe(true)
    expect(capturedUrls.some((u) => u.includes('openstreetmap.ru'))).toBe(true)
    expect(capturedUrls.some((u) => u.includes('kumi.systems'))).toBe(true)
  })
})
