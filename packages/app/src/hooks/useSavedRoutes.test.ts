import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSavedRoutes } from './useSavedRoutes'

vi.mock('./usePlatform')
vi.mock('./useTelegramWebApp')
vi.mock('../store/useMapStore')
vi.mock('../services/api')

import { usePlatform } from './usePlatform'
import { useTelegramWebApp } from './useTelegramWebApp'
import {
  listSavedRoutes,
  createSavedRoute,
  deleteSavedRoute as apiDeleteSavedRoute,
} from '../services/api'
import { useMapStore } from '../store/useMapStore'

const mockUsePlatform = vi.mocked(usePlatform)
const mockUseTelegramWebApp = vi.mocked(useTelegramWebApp)
const mockListSavedRoutes = vi.mocked(listSavedRoutes)
const mockCreateSavedRoute = vi.mocked(createSavedRoute)
const mockApiDeleteSavedRoute = vi.mocked(apiDeleteSavedRoute)
const mockUseMapStore = vi.mocked(useMapStore)

const MOCK_USER = { id: 'user-1', telegramId: 12345, name: 'Alice', username: 'alice' }

const MOCK_ROUTE = {
  id: 'route-1',
  name: 'Minsk Loop',
  waypoints: [
    { id: 'wp1', lat: 53.9, lng: 27.5, order: 0, type: 'start' as const, label: 'Start' },
    { id: 'wp2', lat: 53.95, lng: 27.6, order: 1, type: 'end' as const, label: 'End' },
  ],
  distanceKm: 10,
  elevationM: 50,
  profileId: 'bike',
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
}

const mockActions = {
  addLocalRoute: vi.fn(),
  removeLocalRoute: vi.fn(),
  clearLocalRoutes: vi.fn(),
  setWaypoints: vi.fn(),
  setAccountOpen: vi.fn(),
}

type MockState = {
  authUser: typeof MOCK_USER | null
  debugSimulateAuth: boolean
  profile: string
  routeResult: null | { distance: number; elevation: number[] }
  waypoints: Array<{ id: string; lat: number; lng: number; order: number; type: string; label?: string }>
  localRoutes: Array<{ id: string; name: string; waypoints: typeof MOCK_ROUTE.waypoints }>
  actions: typeof mockActions
}

let mockState: MockState

function setupMockStore(overrides: Partial<MockState> = {}) {
  mockState = {
    authUser: null,
    debugSimulateAuth: false,
    profile: 'bike',
    routeResult: null,
    waypoints: [],
    localRoutes: [],
    actions: mockActions,
    ...overrides,
  }
  mockUseMapStore.mockImplementation(
    (selector: unknown) => (selector as (s: MockState) => unknown)(mockState) as never,
  )
  Object.assign(useMapStore, {
    getState: vi.fn(() => mockState),
  })
}

function setupTelegramWebApp(initData?: string) {
  mockUseTelegramWebApp.mockReturnValue({
    webApp: initData ? { initData } : undefined,
    isAvailable: !!initData,
    stableHeight: 0,
    haptic: { impact: vi.fn(), notification: vi.fn(), selection: vi.fn() },
    backButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
  } as never)
}

describe('useSavedRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockStore()
    mockUsePlatform.mockReturnValue({ isTMA: false, isIAB: false, isMobile: false, showBottomNav: false })
    setupTelegramWebApp()
    mockListSavedRoutes.mockResolvedValue([])
    mockCreateSavedRoute.mockResolvedValue(MOCK_ROUTE)
    mockApiDeleteSavedRoute.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('returns empty savedRoutes when not logged in', () => {
      const { result } = renderHook(() => useSavedRoutes())
      expect(result.current.savedRoutes).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('does not call listSavedRoutes when not logged in', async () => {
      renderHook(() => useSavedRoutes())
      await vi.waitFor(() => {})
      expect(mockListSavedRoutes).not.toHaveBeenCalled()
    })
  })

  describe('debug simulation mode', () => {
    beforeEach(() => {
      setupMockStore({ debugSimulateAuth: true })
    })

    it('returns 3 mock routes', () => {
      const { result } = renderHook(() => useSavedRoutes())
      expect(result.current.savedRoutes).toHaveLength(3)
    })

    it('isLoading is false immediately', () => {
      const { result } = renderHook(() => useSavedRoutes())
      expect(result.current.isLoading).toBe(false)
    })

    it('isMigrating is false in debug mode', () => {
      const { result } = renderHook(() => useSavedRoutes())
      expect(result.current.isMigrating).toBe(false)
    })

    it('does not call listSavedRoutes in debug mode', async () => {
      renderHook(() => useSavedRoutes())
      await vi.waitFor(() => {})
      expect(mockListSavedRoutes).not.toHaveBeenCalled()
    })
  })

  describe('loading routes when authenticated', () => {
    beforeEach(() => {
      setupMockStore({ authUser: MOCK_USER })
    })

    it('calls listSavedRoutes on mount', async () => {
      renderHook(() => useSavedRoutes())
      await waitFor(() => expect(mockListSavedRoutes).toHaveBeenCalledOnce())
    })

    it('populates savedRoutes with API response', async () => {
      mockListSavedRoutes.mockResolvedValue([MOCK_ROUTE])
      const { result } = renderHook(() => useSavedRoutes())
      await waitFor(() => expect(result.current.savedRoutes).toHaveLength(1))
      expect(result.current.savedRoutes[0].id).toBe('route-1')
    })

    it('sets error when listSavedRoutes rejects', async () => {
      mockListSavedRoutes.mockRejectedValue(new Error('API error'))
      const { result } = renderHook(() => useSavedRoutes())
      await waitFor(() => expect(result.current.error).toBe('API error'))
    })

    it('isLoading is false after fetch completes', async () => {
      const { result } = renderHook(() => useSavedRoutes())
      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    it('passes x-telegram-initdata header in TMA mode', async () => {
      mockUsePlatform.mockReturnValue({ isTMA: true, isIAB: false, isMobile: false, showBottomNav: true })
      setupTelegramWebApp('tma-data-abc')
      renderHook(() => useSavedRoutes())
      await waitFor(() => expect(mockListSavedRoutes).toHaveBeenCalledWith(
        expect.objectContaining({ 'x-telegram-initdata': 'tma-data-abc' }),
      ))
    })

    it('passes empty header in web mode', async () => {
      renderHook(() => useSavedRoutes())
      await waitFor(() => expect(mockListSavedRoutes).toHaveBeenCalledWith({}))
    })
  })

  describe('post-login migration of localRoutes', () => {
    const LOCAL_ROUTE = {
      id: 'local-1',
      name: 'Local Route',
      waypoints: MOCK_ROUTE.waypoints,
      createdAt: '2026-04-01T00:00:00.000Z',
    }

    beforeEach(() => {
      setupMockStore({ authUser: MOCK_USER, localRoutes: [LOCAL_ROUTE] })
      mockListSavedRoutes.mockResolvedValue([])
    })

    it('creates a saved route for each local route', async () => {
      renderHook(() => useSavedRoutes())
      await waitFor(() => expect(mockCreateSavedRoute).toHaveBeenCalledOnce())
      expect(mockCreateSavedRoute).toHaveBeenCalledWith(
        expect.objectContaining({ name: LOCAL_ROUTE.name }),
        expect.anything(),
      )
    })

    it('clears localRoutes after migration', async () => {
      renderHook(() => useSavedRoutes())
      await waitFor(() => expect(mockActions.clearLocalRoutes).toHaveBeenCalledOnce())
    })

    it('skips migration when localRoutes is empty', async () => {
      setupMockStore({ authUser: MOCK_USER, localRoutes: [] })
      renderHook(() => useSavedRoutes())
      await waitFor(() => expect(mockListSavedRoutes).toHaveBeenCalled())
      expect(mockCreateSavedRoute).not.toHaveBeenCalled()
    })
  })

  describe('saveCurrentRoute', () => {
    it('when logged in: calls createSavedRoute and prepends to list', async () => {
      setupMockStore({
        authUser: MOCK_USER,
        waypoints: [{ id: 'wp1', lat: 53.9, lng: 27.5, order: 0, type: 'start' }],
      })
      mockListSavedRoutes.mockResolvedValue([])
      const { result } = renderHook(() => useSavedRoutes())
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => { await result.current.saveCurrentRoute('My Route') })

      expect(mockCreateSavedRoute).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Route', profileId: 'bike' }),
        expect.anything(),
      )
      expect(result.current.savedRoutes).toHaveLength(1)
    })

    it('when not logged in: adds a localRoute to store', async () => {
      setupMockStore({
        authUser: null,
        waypoints: [{ id: 'wp1', lat: 53.9, lng: 27.5, order: 0, type: 'start' }],
      })
      const { result } = renderHook(() => useSavedRoutes())

      await act(async () => { await result.current.saveCurrentRoute('Offline Route') })

      expect(mockCreateSavedRoute).not.toHaveBeenCalled()
      expect(mockActions.addLocalRoute).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Offline Route' }),
      )
    })

    it('filters out placeholder waypoints (NaN lat) before saving', async () => {
      setupMockStore({
        authUser: MOCK_USER,
        waypoints: [
          { id: 'wp1', lat: 53.9, lng: 27.5, order: 0, type: 'start' },
          { id: 'wp2', lat: NaN, lng: NaN, order: 1, type: 'end' },
        ],
      })
      mockListSavedRoutes.mockResolvedValue([])
      const { result } = renderHook(() => useSavedRoutes())
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => { await result.current.saveCurrentRoute('Filtered Route') })

      const calledPayload = mockCreateSavedRoute.mock.lastCall![0] as { waypoints: Array<{ id: string }> }
      expect(calledPayload.waypoints).toHaveLength(1)
      expect(calledPayload.waypoints[0].id).toBe('wp1')
    })
  })

  describe('deleteRoute', () => {
    it('when logged in: calls API and removes from local list', async () => {
      setupMockStore({ authUser: MOCK_USER })
      mockListSavedRoutes.mockResolvedValue([MOCK_ROUTE])
      const { result } = renderHook(() => useSavedRoutes())
      await waitFor(() => expect(result.current.savedRoutes).toHaveLength(1))

      await act(async () => { await result.current.deleteRoute('route-1') })

      expect(mockApiDeleteSavedRoute).toHaveBeenCalledWith('route-1', expect.anything())
      expect(result.current.savedRoutes).toHaveLength(0)
    })

    it('when not logged in: calls removeLocalRoute', async () => {
      setupMockStore({ authUser: null })
      const { result } = renderHook(() => useSavedRoutes())

      await act(async () => { await result.current.deleteRoute('local-1') })

      expect(mockActions.removeLocalRoute).toHaveBeenCalledWith('local-1')
      expect(mockApiDeleteSavedRoute).not.toHaveBeenCalled()
    })
  })

  describe('loadRoute', () => {
    it('calls setWaypoints with all route waypoints at once', () => {
      const { result } = renderHook(() => useSavedRoutes())

      act(() => { result.current.loadRoute(MOCK_ROUTE) })

      expect(mockActions.setWaypoints).toHaveBeenCalledOnce()
      const points = mockActions.setWaypoints.mock.calls[0][0] as Array<{ lat: number }>
      expect(points).toHaveLength(MOCK_ROUTE.waypoints.length)
    })

    it('closes account panel after loading', () => {
      const { result } = renderHook(() => useSavedRoutes())

      act(() => { result.current.loadRoute(MOCK_ROUTE) })

      expect(mockActions.setAccountOpen).toHaveBeenCalledWith(false)
    })

    it('passes correct waypoint data to setWaypoints', () => {
      const { result } = renderHook(() => useSavedRoutes())

      act(() => { result.current.loadRoute(MOCK_ROUTE) })

      const points = mockActions.setWaypoints.mock.calls[0][0] as Array<Record<string, unknown>>
      expect(points[0]).toMatchObject({ lat: 53.9, lng: 27.5, label: 'Start' })
    })
  })
})
