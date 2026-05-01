import { describe, it, expect, vi, beforeEach } from 'vitest'
import { geocode, reverseGeocode } from './geocode'

const mockResult = (display: string) => ({
  lat: '52.1',
  lon: '23.7',
  display_name: display,
  address: { road: 'Кирова', house_number: '15', city: 'Брест' },
})

describe('geocode', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns results on first attempt when Nominatim responds', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++
      return new Response(JSON.stringify([mockResult('Кирова 15, Брест')]), { status: 200 })
    })

    const results = await geocode('брест кирова 15')
    expect(results).toHaveLength(1)
    expect(results[0].lat).toBe(52.1)
    expect(callCount).toBe(1)
  })

  it('falls back to reordered query (attempt 2) when first returns empty', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      callCount++
      const urlStr = String(url)
      // Return results only for reordered query
      if (urlStr.includes('кирова+15%2C+брест') || urlStr.includes('кирова+15%2C%20брест') || urlStr.includes('%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D0%B0+15%2C')) {
        return new Response(JSON.stringify([mockResult('Кирова 15, Брест')]), { status: 200 })
      }
      return new Response(JSON.stringify([]), { status: 200 })
    })

    const results = await geocode('брест кирова 15')
    expect(callCount).toBeGreaterThanOrEqual(2)
    expect(results).toHaveLength(1)
  })

  it('falls back to structured params (attempt 3) when attempts 1 and 2 return empty', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      callCount++
      const urlStr = String(url)
      // Return results only on structured query (has street= param)
      if (urlStr.includes('street=')) {
        return new Response(JSON.stringify([mockResult('Кирова 15, Брест')]), { status: 200 })
      }
      return new Response(JSON.stringify([]), { status: 200 })
    })

    const results = await geocode('брест кирова 15')
    expect(callCount).toBe(3)
    expect(results).toHaveLength(1)
  })

  it('returns empty array when all attempts fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    )
    const results = await geocode('xyzzy12345')
    expect(results).toHaveLength(0)
  })

  it('does not apply reorder to query with comma', async () => {
    let queries: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      queries.push(String(url))
      return new Response(JSON.stringify([mockResult('test')]), { status: 200 })
    })

    await geocode('кирова 15, брест')
    // Only one attempt needed — comma-separated queries go to Nominatim as-is
    expect(queries).toHaveLength(1)
  })

  it('returns empty array for empty input', async () => {
    const results = await geocode('')
    expect(results).toHaveLength(0)
  })

  it('sends User-Agent header to Nominatim', async () => {
    let capturedInit: RequestInit | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedInit = init
      return new Response(JSON.stringify([mockResult('Test')]), { status: 200 })
    })

    await geocode('минск немига 5')
    expect(capturedInit?.headers).toBeDefined()
    expect((capturedInit!.headers as Record<string, string>)['User-Agent']).toMatch(/^TrailX\//)
  })
})

describe('reverseGeocode', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends User-Agent header for reverse requests', async () => {
    let capturedInit: RequestInit | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedInit = init
      return new Response(
        JSON.stringify({ display_name: 'Немига, Минск', address: { road: 'Немига', city: 'Минск' } }),
        { status: 200 },
      )
    })

    await reverseGeocode(53.9, 27.56)
    expect((capturedInit!.headers as Record<string, string>)['User-Agent']).toMatch(/^TrailX\//)
  })
})
