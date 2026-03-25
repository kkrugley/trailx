import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSessionLoader } from './useSessionLoader'

vi.mock('../services/api')
vi.mock('../store/useMapStore')

import { getSession, SessionNotFoundError } from '../services/api'
import { useMapStore } from '../store/useMapStore'

const mockGetSession = vi.mocked(getSession)
const mockUseMapStore = vi.mocked(useMapStore)

const MOCK_ACTIONS = {
  clearRoute: vi.fn(),
  addWaypoint: vi.fn(),
  setRouteResult: vi.fn(),
  updateSettings: vi.fn(),
  setRouteError: vi.fn(),
  setStandalonePois: vi.fn(),
  setMeasureSessions: vi.fn(),
}

const MOCK_POI = { id: 'poi-1', lat: 48.85, lng: 2.35, name: 'Eiffel Tower', category: 'tourism' as const }
const MOCK_MEASURE = { id: 'ms-1', color: '#f00', nodes: [[2.3, 48.8] as [number, number]], distance: 1.2 }

const MOCK_PAYLOAD = {
  waypoints: [
    { id: 'wp-1', lat: 48.8, lng: 2.3, order: 0, type: 'start' },
    { id: 'wp-2', lat: 48.9, lng: 2.4, order: 1, type: 'end' },
  ],
  routeResult: { distance: 1000, duration: 300, geometry: {}, elevation: [] },
  standalonePois: [MOCK_POI],
  measureSessions: [MOCK_MEASURE],
  appSettings: { distanceUnit: 'mi' },
}

const MOCK_SESSION_RESPONSE = {
  id: 'session-123',
  payload: MOCK_PAYLOAD,
  name: 'My route',
  expiresAt: '2026-04-08T00:00:00.000Z',
}

function setupMapStore() {
  mockUseMapStore.mockReturnValue({ actions: MOCK_ACTIONS } as never)
  Object.assign(useMapStore, {
    getState: vi.fn().mockReturnValue({ actions: MOCK_ACTIONS }),
  })
}

function setPathname(path: string, search = '') {
  Object.defineProperty(window, 'location', {
    value: { pathname: path, search, href: `http://localhost${path}${search}` },
    writable: true,
  })
}

describe('useSessionLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMapStore()
    vi.spyOn(history, 'replaceState').mockImplementation(() => {})
    // Default: no session in URL
    setPathname('/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing when no sessionId in URL — isLoading stays false', () => {
    setPathname('/')
    const { result } = renderHook(() => useSessionLoader())
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('parses sessionId from /s/:id path', async () => {
    setPathname('/s/session-123')
    mockGetSession.mockResolvedValue(MOCK_SESSION_RESPONSE)

    const { result } = renderHook(() => useSessionLoader())
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockGetSession).toHaveBeenCalledWith('session-123')
  })

  it('parses sessionId from ?session= query param', async () => {
    setPathname('/', '?session=session-456')
    mockGetSession.mockResolvedValue({ ...MOCK_SESSION_RESPONSE, id: 'session-456' })

    renderHook(() => useSessionLoader())
    await waitFor(() => expect(mockGetSession).toHaveBeenCalledWith('session-456'))
  })

  it('patches store with waypoints, routeResult, appSettings, standalonePois and measureSessions after successful load', async () => {
    setPathname('/s/session-123')
    mockGetSession.mockResolvedValue(MOCK_SESSION_RESPONSE)

    const { result } = renderHook(() => useSessionLoader())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(MOCK_ACTIONS.clearRoute).toHaveBeenCalled()
    expect(MOCK_ACTIONS.addWaypoint).toHaveBeenCalledTimes(MOCK_PAYLOAD.waypoints.length)
    expect(MOCK_ACTIONS.setRouteResult).toHaveBeenCalledWith(MOCK_PAYLOAD.routeResult)
    expect(MOCK_ACTIONS.setStandalonePois).toHaveBeenCalledWith(MOCK_PAYLOAD.standalonePois)
    expect(MOCK_ACTIONS.setMeasureSessions).toHaveBeenCalledWith(MOCK_PAYLOAD.measureSessions)
    expect(MOCK_ACTIONS.updateSettings).toHaveBeenCalledWith(MOCK_PAYLOAD.appSettings)
  })

  it('restores non-empty standalonePois from session', async () => {
    setPathname('/s/session-123')
    mockGetSession.mockResolvedValue(MOCK_SESSION_RESPONSE)

    const { result } = renderHook(() => useSessionLoader())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(MOCK_ACTIONS.setStandalonePois).toHaveBeenCalledWith([MOCK_POI])
  })

  it('restores non-empty measureSessions from session', async () => {
    setPathname('/s/session-123')
    mockGetSession.mockResolvedValue(MOCK_SESSION_RESPONSE)

    const { result } = renderHook(() => useSessionLoader())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(MOCK_ACTIONS.setMeasureSessions).toHaveBeenCalledWith([MOCK_MEASURE])
  })

  it('cleans URL after successful load', async () => {
    setPathname('/s/session-123')
    mockGetSession.mockResolvedValue(MOCK_SESSION_RESPONSE)

    const { result } = renderHook(() => useSessionLoader())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(history.replaceState).toHaveBeenCalled()
  })

  it('sets error string for SessionNotFoundError', async () => {
    setPathname('/s/gone-session')
    mockGetSession.mockRejectedValue(new SessionNotFoundError())

    const { result } = renderHook(() => useSessionLoader())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBe('Сессия не найдена или истекла')
  })

  it('sets generic error string for unexpected errors', async () => {
    setPathname('/s/bad-session')
    mockGetSession.mockRejectedValue(new Error('Network failure'))

    const { result } = renderHook(() => useSessionLoader())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBe('Не удалось загрузить сессию')
  })
})
