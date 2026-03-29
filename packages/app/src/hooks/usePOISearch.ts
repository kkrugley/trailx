import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'
import { fetchPOIsAlongRoute } from '../services/overpass'
import { POI_CATEGORIES } from '@trailx/shared'

const DEBOUNCE_MS = 800

export function usePOISearch(): void {
  const routeResult = useMapStore((s) => s.routeResult)
  const poiBuffer = useMapStore((s) => s.appSettings.poiBuffer)
  const { setAllPois, setIsSearchingPOI } = useMapStore((s) => s.actions)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Cancel previous debounce and in-flight requests
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    abortRef.current?.abort()

    if (!routeResult) {
      setAllPois([])
      return
    }

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller

      setIsSearchingPOI(true)
      try {
        const found = await fetchPOIsAlongRoute(
          routeResult.geometry,
          poiBuffer,
          [...POI_CATEGORIES],
          controller.signal,
        )
        if (controller.signal.aborted) return
        setAllPois(found)
      } catch (err) {
        if (controller.signal.aborted) return
        console.error('[poi] fetchPOIsAlongRoute failed:', err)
        setAllPois([])
      } finally {
        if (!controller.signal.aborted) setIsSearchingPOI(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [routeResult, poiBuffer, setAllPois, setIsSearchingPOI])
}
