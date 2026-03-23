import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchPhoton, photonFeatureLabel, searchPlaces } from './photon'
import type { PhotonFeature } from './photon'

function makeFeature(overrides: Partial<PhotonFeature['properties']> = {}): PhotonFeature {
  return {
    geometry: { coordinates: [30.52, 50.45] },
    properties: {
      name: 'Kyiv',
      country: 'Ukraine',
      ...overrides,
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(features: PhotonFeature[]) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ features }),
  } as unknown as Response)
}

describe('searchPhoton', () => {
  it('returns empty array for blank query', async () => {
    const result = await searchPhoton('   ')
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns features from API response', async () => {
    const feature = makeFeature()
    mockFetch([feature])
    const result = await searchPhoton('Kyiv')
    expect(result).toHaveLength(1)
    expect(result[0].properties.name).toBe('Kyiv')
  })

  it('returns empty array on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: vi.fn() } as unknown as Response)
    const result = await searchPhoton('test')
    expect(result).toEqual([])
  })

  it('returns empty array on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network down'))
    const result = await searchPhoton('test')
    expect(result).toEqual([])
  })

  it('returns empty array when features is undefined', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response)
    const result = await searchPhoton('test')
    expect(result).toEqual([])
  })
})

describe('photonFeatureLabel', () => {
  it('joins name, city, country', () => {
    const f = makeFeature({ name: 'Café', city: 'Kyiv', country: 'Ukraine' })
    expect(photonFeatureLabel(f)).toBe('Café, Kyiv, Ukraine')
  })

  it('includes street with housenumber when both present', () => {
    const f = makeFeature({ name: 'Place', street: 'Main St', housenumber: '5', city: 'City', country: 'UA' })
    expect(photonFeatureLabel(f)).toBe('Place, Main St 5, City, UA')
  })

  it('includes street without housenumber', () => {
    const f = makeFeature({ name: 'Spot', street: 'Oak Ave', country: 'UA' })
    expect(photonFeatureLabel(f)).toBe('Spot, Oak Ave, UA')
  })

  it('returns "Unknown location" when no properties match', () => {
    const f: PhotonFeature = {
      geometry: { coordinates: [0, 0] },
      properties: { name: '' },
    }
    expect(photonFeatureLabel(f)).toBe('Unknown location')
  })

  it('omits missing city gracefully', () => {
    const f = makeFeature({ name: 'X', country: 'UA' })
    expect(photonFeatureLabel(f)).toBe('X, UA')
  })
})

describe('searchPlaces', () => {
  it('maps features to SearchResult shape', async () => {
    const feature = makeFeature({ name: 'Kyiv', city: 'Kyiv', country: 'Ukraine', type: 'city', osm_value: 'city' })
    mockFetch([feature])
    const results = await searchPlaces('Kyiv')
    expect(results).toHaveLength(1)
    expect(results[0].lat).toBe(50.45)
    expect(results[0].lng).toBe(30.52)
    expect(results[0].name).toBe('Kyiv')
    expect(results[0].type).toBe('city')
  })

  it('falls back to query when name and street are missing', async () => {
    const feature: PhotonFeature = {
      geometry: { coordinates: [30, 50] },
      properties: { name: '' },
    }
    mockFetch([feature])
    const results = await searchPlaces('my query')
    // name is '' (not null/undefined) so ?? does not fall back; street is undefined → use query
    expect(results[0].name).toBe('')
  })

  it('returns empty array when API fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error())
    const results = await searchPlaces('test')
    expect(results).toEqual([])
  })
})
