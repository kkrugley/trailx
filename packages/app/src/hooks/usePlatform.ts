import { useEffect, useMemo, useState } from 'react'

export interface PlatformContext {
  isTMA: boolean
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

function detectMobile(): boolean {
  return window.innerWidth < 768 || 'ontouchstart' in window
}

export function usePlatform(): PlatformContext {
  const isTMA = useMemo(() => detectTMA(), [])
  const [isMobile, setIsMobile] = useState<boolean>(detectMobile)

  useEffect(() => {
    const handler = () => setIsMobile(detectMobile())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return useMemo(
    () => ({ isTMA, isMobile, showBottomNav: isMobile || isTMA }),
    [isTMA, isMobile],
  )
}
