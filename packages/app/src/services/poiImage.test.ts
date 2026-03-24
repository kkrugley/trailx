import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchWikidataImage,
  fetchMapillaryImage,
  getCategoryPlaceholder,
  streamPOIImages,
} from './poiImage'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.unstubAllEnvs()
})

// ── fetchWikidataImage ────────────────────────────────────────────────────────

describe('fetchWikidataImage', () => {
  it('returns Commons URL when P18 claim exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        claims: {
          P18: [{ mainsnak: { datavalue: { value: 'Eiffel_tower.jpg' } } }],
        },
      }),
    }))

    const url = await fetchWikidataImage('Q243')
    expect(url).toContain('commons.wikimedia.org')
    expect(url).toContain('Eiffel_tower.jpg')
    expect(url).toContain('width=600')
  })

  it('URL-encodes filename with special characters', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        claims: {
          P18: [{ mainsnak: { datavalue: { value: 'Some file (1).jpg' } } }],
        },
      }),
    }))

    const url = await fetchWikidataImage('Q999')
    expect(url).toContain(encodeURIComponent('Some file (1).jpg'))
  })

  it('returns null when P18 claim is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ claims: {} }),
    }))

    const url = await fetchWikidataImage('Q1')
    expect(url).toBeNull()
  })

  it('returns null when claims is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }))

    const url = await fetchWikidataImage('Q2')
    expect(url).toBeNull()
  })

  it('returns null on network error (never throws)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network')))
    const url = await fetchWikidataImage('Q3')
    expect(url).toBeNull()
  })
})

// ── fetchMapillaryImage ───────────────────────────────────────────────────────

describe('fetchMapillaryImage', () => {
  it('returns null when VITE_MAPILLARY_TOKEN is not set', async () => {
    // env not stubbed — token is undefined
    const url = await fetchMapillaryImage(52.1, 23.5)
    expect(url).toBeNull()
  })

  it('returns thumb URL when token is set and data is present', async () => {
    vi.stubEnv('VITE_MAPILLARY_TOKEN', 'test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ id: '1', thumb_256_url: 'https://mapillary.example/img.jpg' }],
      }),
    }))

    const url = await fetchMapillaryImage(52.1, 23.5)
    expect(url).toBe('https://mapillary.example/img.jpg')
  })

  it('returns null when data array is empty', async () => {
    vi.stubEnv('VITE_MAPILLARY_TOKEN', 'test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    }))

    const url = await fetchMapillaryImage(52.1, 23.5)
    expect(url).toBeNull()
  })

  it('includes token and bbox in fetch URL', async () => {
    vi.stubEnv('VITE_MAPILLARY_TOKEN', 'my-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchMapillaryImage(52.0, 23.0)
    const url: string = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('access_token=my-token')
    expect(url).toContain('bbox=')
  })

  it('returns null on network error (never throws)', async () => {
    vi.stubEnv('VITE_MAPILLARY_TOKEN', 'test-token')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network')))
    const url = await fetchMapillaryImage(52.1, 23.5)
    expect(url).toBeNull()
  })
})

// ── getCategoryPlaceholder ────────────────────────────────────────────────────

describe('getCategoryPlaceholder', () => {
  it('uses "historic" tag as seed keyword', () => {
    const url = getCategoryPlaceholder({ historic: 'castle', amenity: 'parking' })
    expect(url).toContain('castle')
    expect(url).toContain('picsum.photos/seed/')
  })

  it('falls back through natural → tourism → amenity', () => {
    const url = getCategoryPlaceholder({ amenity: 'cafe' })
    expect(url).toContain('cafe')
  })

  it('uses "landscape" as final fallback when no known tag', () => {
    const url = getCategoryPlaceholder({})
    expect(url).toContain('landscape')
  })

  it('returns 600x338 dimensions', () => {
    const url = getCategoryPlaceholder({ natural: 'peak' })
    expect(url).toMatch(/\/600\/338$/)
  })
})

// ── streamPOIImages ───────────────────────────────────────────────────────────

describe('streamPOIImages', () => {
  const poi = { lat: 52.1, lon: 23.5, tags: { wikidata: 'Q243' } }

  it('yields wikidata image when available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        claims: { P18: [{ mainsnak: { datavalue: { value: 'img.jpg' } } }] },
      }),
    }))

    const results = []
    for await (const r of streamPOIImages(poi)) results.push(r)

    expect(results.some((r) => r.source === 'wikidata')).toBe(true)
    expect(results[0].url).toContain('img.jpg')
  })

  it('yields mapillary image when token is set', async () => {
    vi.stubEnv('VITE_MAPILLARY_TOKEN', 'tok')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ thumb_256_url: 'https://mapillary.example/x.jpg' }],
      }),
    }))

    const results = []
    for await (const r of streamPOIImages({ lat: 52.1, lon: 23.5, tags: {} })) {
      results.push(r)
    }
    expect(results.some((r) => r.source === 'mapillary')).toBe(true)
  })

  it('skips wikidata step when no wikidata tag', async () => {
    vi.stubEnv('VITE_MAPILLARY_TOKEN', 'tok')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = []
    for await (const r of streamPOIImages({ lat: 52.1, lon: 23.5, tags: {} })) {
      results.push(r)
    }
    // fetch was only called once (Mapillary), not twice
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(results).toHaveLength(0)
  })

  it('yields nothing when all sources fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network')))

    const results = []
    for await (const r of streamPOIImages(poi)) results.push(r)
    expect(results).toHaveLength(0)
  })
})
