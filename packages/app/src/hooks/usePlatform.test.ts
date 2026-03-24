import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlatform } from './usePlatform'

// Double-assertion helper to bypass the strict global TelegramWebApp type from @twa-dev/sdk
type TelegramStub = { Telegram?: { WebApp?: { initData: string } } }

function setTelegram(initData: string | null) {
  const w = window as unknown as TelegramStub
  if (initData === null) {
    delete w.Telegram
  } else {
    w.Telegram = { WebApp: { initData } }
  }
}

const originalInnerWidth = window.innerWidth

beforeEach(() => {
  setTelegram(null)
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
  delete (window as Window & { ontouchstart?: unknown }).ontouchstart
})

afterEach(() => {
  setTelegram(null)
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: originalInnerWidth,
  })
})

describe('usePlatform — TMA detection', () => {
  it('isTMA is false when window.Telegram is absent', () => {
    const { result } = renderHook(() => usePlatform())
    expect(result.current.isTMA).toBe(false)
  })

  it('isTMA is false when initData is empty string', () => {
    setTelegram('')
    const { result } = renderHook(() => usePlatform())
    expect(result.current.isTMA).toBe(false)
  })

  it('isTMA is true when initData is non-empty', () => {
    setTelegram('query_id=abc')
    const { result } = renderHook(() => usePlatform())
    expect(result.current.isTMA).toBe(true)
  })
})

describe('usePlatform — mobile detection', () => {
  it('isMobile is false on wide viewport without touch', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
    const { result } = renderHook(() => usePlatform())
    expect(result.current.isMobile).toBe(false)
  })

  it('isMobile is true when innerWidth < 768', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    const { result } = renderHook(() => usePlatform())
    expect(result.current.isMobile).toBe(true)
  })

  it('isMobile is true exactly at width 767', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 767 })
    const { result } = renderHook(() => usePlatform())
    expect(result.current.isMobile).toBe(true)
  })

  it('isMobile is false exactly at width 768', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 })
    const { result } = renderHook(() => usePlatform())
    expect(result.current.isMobile).toBe(false)
  })

  it('isMobile is true when ontouchstart is present regardless of width', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 })
    ;(window as Window & { ontouchstart?: unknown }).ontouchstart = () => {}
    const { result } = renderHook(() => usePlatform())
    expect(result.current.isMobile).toBe(true)
  })

  it('updates isMobile on window resize', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
    const { result } = renderHook(() => usePlatform())
    expect(result.current.isMobile).toBe(false)

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current.isMobile).toBe(true)
  })
})

describe('usePlatform — showBottomNav', () => {
  it('showBottomNav is false for desktop non-TMA', () => {
    const { result } = renderHook(() => usePlatform())
    expect(result.current.showBottomNav).toBe(false)
  })

  it('showBottomNav is true on mobile', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 })
    const { result } = renderHook(() => usePlatform())
    expect(result.current.showBottomNav).toBe(true)
  })

  it('showBottomNav is true in TMA even on wide viewport', () => {
    setTelegram('query_id=abc')
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 })
    const { result } = renderHook(() => usePlatform())
    expect(result.current.showBottomNav).toBe(true)
  })
})
