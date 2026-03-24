import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRoute } from './api'

// Stub import.meta.env.VITE_API_URL via vi.stubEnv
beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubGlobal('fetch', vi.fn())
})

function makeFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  })
}

function makeFetchError(status: number) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  })
}

describe('getRoute', () => {
  it('returns parsed RemoteRoute on 200', async () => {
    const route = {
      id: 'abc',
      name: 'Test Route',
      waypoints: [{ lat: 52.1, lng: 23.5, name: 'Start' }, { lat: 52.2, lng: 23.6 }],
    }
    vi.stubGlobal('fetch', makeFetchOk(route))

    const result = await getRoute('abc')
    expect(result.id).toBe('abc')
    expect(result.name).toBe('Test Route')
    expect(result.waypoints).toHaveLength(2)
    expect(result.waypoints[0].lat).toBe(52.1)
  })

  it('calls the correct URL with routeId', async () => {
    const fetchMock = makeFetchOk({ id: 'xyz', name: 'R', waypoints: [] })
    vi.stubGlobal('fetch', fetchMock)

    await getRoute('xyz')
    const calledUrl = (fetchMock.mock.calls[0] as string[])[0]
    expect(calledUrl).toContain('/routes/xyz')
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', makeFetchError(404))
    await expect(getRoute('missing')).rejects.toThrow(/404/)
  })

  it('includes routeId in the error message', async () => {
    vi.stubGlobal('fetch', makeFetchError(403))
    await expect(getRoute('secret')).rejects.toThrow(/secret/)
  })

  it('propagates network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')))
    await expect(getRoute('abc')).rejects.toThrow('Network error')
  })
})
