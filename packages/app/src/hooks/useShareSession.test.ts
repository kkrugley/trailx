import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useShareSession } from './useShareSession'

vi.mock('./usePlatform')
vi.mock('./useTelegramWebApp')
vi.mock('../services/api')
vi.mock('../store/useMapStore')

import { usePlatform } from './usePlatform'
import { useTelegramWebApp } from './useTelegramWebApp'
import { createSession } from '../services/api'
import { useMapStore } from '../store/useMapStore'

const mockUsePlatform = vi.mocked(usePlatform)
const mockUseTelegramWebApp = vi.mocked(useTelegramWebApp)
const mockCreateSession = vi.mocked(createSession)
const mockUseMapStore = vi.mocked(useMapStore)

const MOCK_STORE_STATE = {
  waypoints: [{ id: '1', lat: 48.8, lng: 2.3, order: 0, type: 'start' as const }],
  routeResult: null,
  standalonePois: [],
  measureSessions: [],
  appSettings: { distanceUnit: 'km' },
}

const MOCK_SESSION = {
  id: 'session-abc',
  editToken: 'edit-token-xyz',
  shareUrl: 'https://trailx.app/s/session-abc',
  expiresAt: '2026-04-08T00:00:00.000Z',
}

function setupMapStore() {
  // Mock both the hook call (for React components) and .getState()
  mockUseMapStore.mockReturnValue(MOCK_STORE_STATE as never)
  Object.assign(useMapStore, {
    getState: vi.fn().mockReturnValue(MOCK_STORE_STATE),
  })
}

describe('useShareSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setupMapStore()
    mockCreateSession.mockResolvedValue(MOCK_SESSION)
    // Default: no TMA web app
    mockUseTelegramWebApp.mockReturnValue({
      webApp: undefined,
      isAvailable: false,
      stableHeight: 0,
      haptic: { impact: vi.fn(), notification: vi.fn(), selection: vi.fn() },
      backButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
    } as never)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  describe('desktop (clipboard path)', () => {
    beforeEach(() => {
      mockUsePlatform.mockReturnValue({ isTMA: false, isMobile: false, showBottomNav: false })
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        share: undefined,
      })
    })

    it('calls createSession with device header and payload', async () => {
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ waypoints: MOCK_STORE_STATE.waypoints }),
        expect.objectContaining({ 'x-device-id': expect.any(String) }),
      )
    })

    it('creates and persists deviceId in localStorage', async () => {
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })

      const deviceId = localStorage.getItem('trailx-device-id')
      expect(deviceId).toBeTruthy()
      expect(typeof deviceId).toBe('string')
    })

    it('reuses existing deviceId from localStorage', async () => {
      localStorage.setItem('trailx-device-id', 'my-existing-device-id-1234')
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.anything(),
        { 'x-device-id': 'my-existing-device-id-1234' },
      )
    })

    it('saves editToken to localStorage after successful create', async () => {
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })

      const tokens = JSON.parse(localStorage.getItem('trailx-session-tokens') ?? '{}') as Record<string, string>
      expect(tokens[MOCK_SESSION.id]).toBe(MOCK_SESSION.editToken)
    })

    it('writes shareUrl to clipboard', async () => {
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MOCK_SESSION.shareUrl)
    })

    it('sets isCopied to true after copy', async () => {
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })
      expect(result.current.isCopied).toBe(true)
    })

    it('resets isCopied to false after 2000ms', async () => {
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })
      expect(result.current.isCopied).toBe(true)
      act(() => { vi.advanceTimersByTime(2000) })
      expect(result.current.isCopied).toBe(false)
    })

    it('resets isSharing to false after API error', async () => {
      mockCreateSession.mockRejectedValue(new Error('API error'))
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })
      expect(result.current.isSharing).toBe(false)
    })

    it('does not throw when API fails — UI stays intact', async () => {
      mockCreateSession.mockRejectedValue(new Error('Network error'))
      const { result } = renderHook(() => useShareSession())
      await expect(act(async () => { await result.current.share() })).resolves.toBeUndefined()
    })

    it('sets error when createSession rejects', async () => {
      mockCreateSession.mockRejectedValue(new Error('Server error'))
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })
      expect(result.current.error).toBe('Server error')
    })

    it('clearError resets error to null', async () => {
      mockCreateSession.mockRejectedValue(new Error('Server error'))
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })
      expect(result.current.error).toBe('Server error')
      act(() => { result.current.clearError() })
      expect(result.current.error).toBeNull()
    })

    it('error starts as null', () => {
      const { result } = renderHook(() => useShareSession())
      expect(result.current.error).toBeNull()
    })

    it('does not set error for AbortError (user cancellation)', async () => {
      const abortErr = new Error('User cancelled')
      abortErr.name = 'AbortError'
      mockCreateSession.mockRejectedValue(abortErr)
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })
      expect(result.current.error).toBeNull()
    })

    it('sets generic error message when rejection is not an Error instance', async () => {
      mockCreateSession.mockRejectedValue('string rejection')
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })
      expect(result.current.error).toBe('Не удалось поделиться маршрутом')
    })
  })

  describe('TMA path (navigator.share)', () => {
    beforeEach(() => {
      mockUsePlatform.mockReturnValue({ isTMA: true, isMobile: false, showBottomNav: true })
      mockUseTelegramWebApp.mockReturnValue({
        webApp: { initData: 'tma-init-data-string' },
        isAvailable: true,
        stableHeight: 800,
        haptic: { impact: vi.fn(), notification: vi.fn(), selection: vi.fn() },
        backButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
      } as never)
      Object.assign(navigator, {
        share: vi.fn().mockResolvedValue(undefined),
      })
    })

    it('passes initData as x-telegram-initdata header', async () => {
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.anything(),
        { 'x-telegram-initdata': 'tma-init-data-string' },
      )
    })

    it('calls navigator.share with the returned shareUrl', async () => {
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })

      expect(navigator.share).toHaveBeenCalledWith(
        expect.objectContaining({ url: MOCK_SESSION.shareUrl }),
      )
    })
  })

  describe('mobile fallback when navigator.share is unavailable', () => {
    beforeEach(() => {
      mockUsePlatform.mockReturnValue({ isTMA: false, isMobile: true, showBottomNav: true })
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        share: undefined,
      })
    })

    it('falls back to clipboard.writeText', async () => {
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MOCK_SESSION.shareUrl)
    })
  })
})
