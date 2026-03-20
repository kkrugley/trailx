import { useEffect, useRef, useState } from 'react'
import { searchPhoton, type PhotonFeature } from '../services/photon'

const DEBOUNCE_MS = 300

export function usePhotonSearch(query: string) {
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    abortRef.current?.abort()

    if (!query.trim()) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      const results = await searchPhoton(query, controller.signal)
      setSuggestions(results)
      setIsLoading(false)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [query])

  return { suggestions, isLoading }
}
