import { useState } from 'react'
import { usePlatform } from './usePlatform'

export interface UseShareSessionReturn {
  share: () => Promise<void>
  isCopied: boolean
  isSharing: boolean
}

// TODO: replace with real API call
const STUB_URL = 'https://trailx.app/s/stub-session-id'

export function useShareSession(): UseShareSessionReturn {
  const { isMobile, isTMA } = usePlatform()
  const [isCopied, setIsCopied] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  async function share() {
    setIsSharing(true)
    try {
      if ((isMobile || isTMA) && typeof navigator.share === 'function') {
        await navigator.share({
          url: STUB_URL,
          title: 'TrailX route',
          text: 'Посмотри мой маршрут в TrailX',
        })
      } else {
        await navigator.clipboard.writeText(STUB_URL)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      }
    } catch (err) {
      // User cancellation is not an error
      if (err instanceof Error && err.name !== 'AbortError') {
        console.warn('[useShareSession] share failed:', err)
      }
    } finally {
      setIsSharing(false)
    }
  }

  return { share, isCopied, isSharing }
}
