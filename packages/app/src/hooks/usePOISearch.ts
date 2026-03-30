import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'
import { fetchPOIsAlongRoute } from '../services/overpass'
import { POI_CATEGORIES } from '@trailx/shared'

const DEBOUNCE_MS = 800

export function usePOISearch(): void {
  const routeResult = useMapStore((s) => s.routeResult)
  const poiBuffer = useMapStore((s) => s.appSettings.poiBuffer)
  const { setAllPois, mergePois, setIsSearchingPOI } = useMapStore((s) => s.actions)

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
        // Merge with existing POIs so previously found points remain visible
        // while the new search completes. Deduplication by osmId is done in the store.
        mergePois(found)
      } catch (err) {
        if (controller.signal.aborted) return
        // Preserve existing POIs on error — don't blank the map for a transient failure.
        console.error('[poi] fetchPOIsAlongRoute failed:', err)
      } finally {
        if (!controller.signal.aborted) setIsSearchingPOI(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [routeResult, poiBuffer, setAllPois, mergePois, setIsSearchingPOI])
}
