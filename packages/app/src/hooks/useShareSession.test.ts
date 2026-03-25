import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useShareSession } from './useShareSession'

vi.mock('./usePlatform')

import { usePlatform } from './usePlatform'
const mockUsePlatform = vi.mocked(usePlatform)

const STUB_URL = 'https://trailx.app/s/stub-session-id'

describe('useShareSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('desktop (clipboard path)', () => {
    beforeEach(() => {
      mockUsePlatform.mockReturnValue({ isTMA: false, isMobile: false, showBottomNav: false })
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        share: undefined,
      })
    })

    it('calls clipboard.writeText with stub URL', async () => {
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(STUB_URL)
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
  })

  describe('mobile fallback — no navigator.share', () => {
    beforeEach(() => {
      mockUsePlatform.mockReturnValue({ isTMA: false, isMobile: true, showBottomNav: true })
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        share: undefined,
      })
    })

    it('falls back to clipboard when navigator.share is unavailable', async () => {
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(STUB_URL)
    })
  })

  describe('isSharing state', () => {
    beforeEach(() => {
      mockUsePlatform.mockReturnValue({ isTMA: false, isMobile: false, showBottomNav: false })
    })

    it('isSharing is false before share is called', () => {
      const { result } = renderHook(() => useShareSession())
      expect(result.current.isSharing).toBe(false)
    })

    it('isSharing is false after share completes', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        share: undefined,
      })
      const { result } = renderHook(() => useShareSession())
      await act(async () => { await result.current.share() })
      expect(result.current.isSharing).toBe(false)
    })
  })
})
