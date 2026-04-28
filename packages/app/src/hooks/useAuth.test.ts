import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAuth } from './useAuth'

vi.mock('./usePlatform')
vi.mock('./useTelegramWebApp')
vi.mock('../store/useMapStore')
vi.mock('../services/api')

import { usePlatform } from './usePlatform'
import { useTelegramWebApp } from './useTelegramWebApp'
import { getMe, loginWithTMA, logout as apiLogout } from '../services/api'
import { useMapStore } from '../store/useMapStore'

const mockUsePlatform = vi.mocked(usePlatform)
const mockUseTelegramWebApp = vi.mocked(useTelegramWebApp)
const mockGetMe = vi.mocked(getMe)
const mockLoginWithTMA = vi.mocked(loginWithTMA)
const mockApiLogout = vi.mocked(apiLogout)
const mockUseMapStore = vi.mocked(useMapStore)

const MOCK_USER = {
  id: 'user-1',
  telegramId: 12345,
  name: 'Alice',
  username: 'alice',
  avatarUrl: undefined,
}

const mockSetAuthUser = vi.fn()

type MockState = {
  authUser: typeof MOCK_USER | null
  debugSimulateAuth: boolean
  actions: { setAuthUser: typeof mockSetAuthUser }
}

let mockState: MockState

function setupMockStore(overrides: Partial<MockState> = {}) {
  mockState = {
    authUser: null,
    debugSimulateAuth: false,
    actions: { setAuthUser: mockSetAuthUser },
    ...overrides,
  }
  mockUseMapStore.mockImplementation(
    (selector: unknown) => (selector as (s: MockState) => unknown)(mockState) as never,
  )
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

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockStore()
    mockUsePlatform.mockReturnValue({ isTMA: false, isIAB: false, isMobile: false, showBottomNav: false })
    setupTelegramWebApp()
    mockGetMe.mockResolvedValue(null)
    mockLoginWithTMA.mockResolvedValue(MOCK_USER)
    mockApiLogout.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with isLoggedIn=false and authUser=null', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.isLoggedIn).toBe(false)
    expect(result.current.authUser).toBeNull()
  })

  it('isSimulated is false by default', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.isSimulated).toBe(false)
  })

  describe('web auth path', () => {
    it('calls getMe on mount', async () => {
      renderHook(() => useAuth())
      await waitFor(() => expect(mockGetMe).toHaveBeenCalled())
    })

    it('sets user when getMe returns a user', async () => {
      mockGetMe.mockResolvedValue(MOCK_USER)
      renderHook(() => useAuth())
      await waitFor(() => expect(mockSetAuthUser).toHaveBeenCalledWith(MOCK_USER))
    })

    it('does not call setAuthUser when getMe returns null', async () => {
      mockGetMe.mockResolvedValue(null)
      renderHook(() => useAuth())
      await waitFor(() => expect(mockGetMe).toHaveBeenCalled())
      expect(mockSetAuthUser).not.toHaveBeenCalled()
    })

    it('does not throw when getMe rejects', async () => {
      mockGetMe.mockRejectedValue(new Error('Network error'))
      const { result } = renderHook(() => useAuth())
      await waitFor(() => expect(mockGetMe).toHaveBeenCalled())
      expect(result.current.isLoggedIn).toBe(false)
    })

    it('removes ?auth query param after successful login', async () => {
      mockGetMe.mockResolvedValue(MOCK_USER)
      const replaceState = vi.spyOn(window.history, 'replaceState')
      Object.defineProperty(window, 'location', {
        value: { search: '?auth=success', pathname: '/app', href: '' },
        writable: true, configurable: true,
      })

      renderHook(() => useAuth())
      await waitFor(() => expect(mockSetAuthUser).toHaveBeenCalled())
      expect(replaceState).toHaveBeenCalledWith({}, '', '/app')
    })

    it('does not call replaceState when no ?auth param', async () => {
      mockGetMe.mockResolvedValue(MOCK_USER)
      const replaceState = vi.spyOn(window.history, 'replaceState')
      Object.defineProperty(window, 'location', {
        value: { search: '', pathname: '/', href: '' },
        writable: true, configurable: true,
      })

      renderHook(() => useAuth())
      await waitFor(() => expect(mockSetAuthUser).toHaveBeenCalled())
      expect(replaceState).not.toHaveBeenCalled()
    })

    it('does not update state after unmount (cancelled flag)', async () => {
      let resolveGetMe!: (u: typeof MOCK_USER) => void
      mockGetMe.mockImplementation(
        () => new Promise<typeof MOCK_USER>((r) => { resolveGetMe = r }),
      )

      const { unmount } = renderHook(() => useAuth())
      unmount()
      await act(async () => { resolveGetMe(MOCK_USER) })
      expect(mockSetAuthUser).not.toHaveBeenCalled()
    })
  })

  describe('TMA auth path', () => {
    beforeEach(() => {
      mockUsePlatform.mockReturnValue({ isTMA: true, isIAB: false, isMobile: false, showBottomNav: true })
      setupTelegramWebApp('tma-init-data-xyz')
    })

    it('calls loginWithTMA with initData', async () => {
      renderHook(() => useAuth())
      await waitFor(() => expect(mockLoginWithTMA).toHaveBeenCalledWith('tma-init-data-xyz'))
    })

    it('sets user after successful TMA login', async () => {
      renderHook(() => useAuth())
      await waitFor(() => expect(mockSetAuthUser).toHaveBeenCalledWith(MOCK_USER))
    })

    it('does not throw when loginWithTMA rejects', async () => {
      mockLoginWithTMA.mockRejectedValue(new Error('Unauthorized'))
      const { result } = renderHook(() => useAuth())
      await waitFor(() => expect(mockLoginWithTMA).toHaveBeenCalled())
      expect(result.current.isLoggedIn).toBe(false)
    })

    it('does not call getMe in TMA mode', async () => {
      renderHook(() => useAuth())
      await waitFor(() => expect(mockLoginWithTMA).toHaveBeenCalled())
      expect(mockGetMe).not.toHaveBeenCalled()
    })

    it('skips loginWithTMA when initData is absent', async () => {
      setupTelegramWebApp(undefined)
      renderHook(() => useAuth())
      await waitFor(() => expect(mockGetMe).toHaveBeenCalled())
      expect(mockLoginWithTMA).not.toHaveBeenCalled()
    })
  })

  describe('loginWithTelegram', () => {
    it('sets window.location.href to auth/telegram with return_to param', () => {
      const mockLoc = { href: '', origin: 'https://trailx.ru' }
      Object.defineProperty(window, 'location', { value: mockLoc, writable: true, configurable: true })

      const { result } = renderHook(() => useAuth())
      act(() => { result.current.loginWithTelegram() })
      expect(mockLoc.href).toMatch(/\/auth\/telegram\?return_to=/)
      expect(mockLoc.href).toContain('trailx.ru')
    })
  })

  describe('logout', () => {
    it('calls apiLogout then clears authUser', async () => {
      const { result } = renderHook(() => useAuth())
      await act(async () => { await result.current.logout() })
      expect(mockApiLogout).toHaveBeenCalledOnce()
      expect(mockSetAuthUser).toHaveBeenCalledWith(null)
    })

    it('still clears authUser when apiLogout rejects', async () => {
      mockApiLogout.mockRejectedValue(new Error('Network'))
      const { result } = renderHook(() => useAuth())
      await act(async () => {
        try { await result.current.logout() } catch { /* expected — try/finally re-throws */ }
      })
      expect(mockSetAuthUser).toHaveBeenCalledWith(null)
    })
  })

  describe('debug simulation mode', () => {
    beforeEach(() => {
      setupMockStore({ debugSimulateAuth: true })
    })

    it('returns SIMULATED_USER with isLoggedIn=true and isSimulated=true', () => {
      const { result } = renderHook(() => useAuth())
      expect(result.current.authUser).toMatchObject({ id: 'debug-user-123' })
      expect(result.current.isLoggedIn).toBe(true)
      expect(result.current.isSimulated).toBe(true)
    })

    it('loginWithTelegram is a no-op — does not navigate', () => {
      const mockLoc = { href: '' }
      Object.defineProperty(window, 'location', { value: mockLoc, writable: true, configurable: true })

      const { result } = renderHook(() => useAuth())
      act(() => { result.current.loginWithTelegram() })
      expect(mockLoc.href).toBe('')
    })

    it('logout is a no-op — does not call apiLogout', async () => {
      const { result } = renderHook(() => useAuth())
      await act(async () => { await result.current.logout() })
      expect(mockApiLogout).not.toHaveBeenCalled()
    })
  })
})
