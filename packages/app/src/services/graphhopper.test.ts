import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildRoute, RateLimitError, RoutingError } from './graphhopper'
import type { RoutePoint } from '@trailx/shared'

const WP_A: RoutePoint = { id: 'a', lat: 50.45, lng: 30.52, order: 0, type: 'start' }
const WP_B: RoutePoint = { id: 'b', lat: 50.55, lng: 30.62, order: 1, type: 'end' }

const MOCK_GH_RESPONSE = {
  paths: [
    {
      points: {
        type: 'LineString',
        coordinates: [
          [30.52, 50.45, 100],
          [30.57, 50.50, 110],
          [30.62, 50.55, 90],
        ],
      },
      distance: 14000,
      time: 3600000,
      details: {
        surface: [[0, 3, 'asphalt']],
        road_class: [[0, 3, 'primary']],
      },
    },
  ],
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

describe('buildRoute', () => {
  it('throws RoutingError with fewer than 2 waypoints', async () => {
    await expect(buildRoute([WP_A], 'bike')).rejects.toBeInstanceOf(RoutingError)
  })

  it('returns RouteResult on success', async () => {
    mockFetch(200, MOCK_GH_RESPONSE)
    const result = await buildRoute([WP_A, WP_B], 'bike')
    expect(result.distance).toBe(14000)
    expect(result.duration).toBe(3600) // ms → s
    expect(result.elevation).toEqual([100, 110, 90])
    expect(result.geometry.type).toBe('LineString')
    expect(result.geometry.coordinates).toHaveLength(3)
    // geometry coords should be [lng, lat] without elevation
    expect(result.geometry.coordinates[0]).toHaveLength(2)
  })

  it('expands surface and road_class details', async () => {
    mockFetch(200, MOCK_GH_RESPONSE)
    const result = await buildRoute([WP_A, WP_B], 'bike')
    expect(result.surface).toEqual(['asphalt', 'asphalt', 'asphalt'])
    expect(result.roadClass).toEqual(['primary', 'primary', 'primary'])
  })

  it('throws RateLimitError on 429', async () => {
    mockFetch(429, {})
    await expect(buildRoute([WP_A, WP_B], 'bike')).rejects.toBeInstanceOf(RateLimitError)
  })

  it('throws RoutingError on 401', async () => {
    mockFetch(401, {})
    await expect(buildRoute([WP_A, WP_B], 'bike')).rejects.toBeInstanceOf(RoutingError)
  })

  it('throws RoutingError on non-ok status with message from body', async () => {
    mockFetch(500, { message: 'Internal error' })
    const err = await buildRoute([WP_A, WP_B], 'bike').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RoutingError)
    expect((err as RoutingError).message).toContain('Internal error')
  })

  it('throws RoutingError when paths array is empty', async () => {
    mockFetch(200, { paths: [] })
    await expect(buildRoute([WP_A, WP_B], 'bike')).rejects.toBeInstanceOf(RoutingError)
  })

  it('throws RoutingError on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network failed'))
    await expect(buildRoute([WP_A, WP_B], 'bike')).rejects.toBeInstanceOf(RoutingError)
  })

  it('propagates AbortError when cancelSignal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const err = await buildRoute([WP_A, WP_B], 'bike', controller.signal).catch((e: unknown) => e)
    expect((err as DOMException).name).toBe('AbortError')
  })

  it('sets correct error name on RateLimitError', () => {
    const err = new RateLimitError()
    expect(err.name).toBe('RateLimitError')
    expect(err).toBeInstanceOf(Error)
  })

  it('sets correct error name on RoutingError', () => {
    const err = new RoutingError('test')
    expect(err.name).toBe('RoutingError')
    expect(err.message).toBe('test')
  })
})
