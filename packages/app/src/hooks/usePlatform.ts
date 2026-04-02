import { useEffect, useMemo, useState } from 'react'

export interface PlatformContext {
  isTMA: boolean
  /** True when running inside Telegram's in-app browser (not a Mini App).
   *  window.Telegram.WebApp is defined but initData is empty. */
  isIAB: boolean
  isMobile: boolean
  showBottomNav: boolean
}

function detectTMA(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.Telegram?.WebApp?.initData &&
    window.Telegram.WebApp.initData !== ''
  )
}

function detectIAB(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.Telegram?.WebApp &&
    window.Telegram.WebApp.initData === ''
  )
}

function detectMobile(): boolean {
  return window.innerWidth < 768 || 'ontouchstart' in window
}

export function usePlatform(): PlatformContext {
  const isTMA = useMemo(() => detectTMA(), [])
  const isIAB = useMemo(() => detectIAB(), [])
  const [isMobile, setIsMobile] = useState<boolean>(detectMobile)

  useEffect(() => {
    const handler = () => setIsMobile(detectMobile())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return useMemo(
    () => ({ isTMA, isIAB, isMobile, showBottomNav: isMobile || isTMA || isIAB }),
    [isTMA, isIAB, isMobile],
  )
}
