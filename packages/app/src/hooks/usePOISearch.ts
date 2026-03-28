import { useEffect, useRef } from 'react'
import type { POI, POICategory } from '@trailx/shared'
import { POI_TIER1, POI_TIER2 } from '@trailx/shared'
import { useMapStore } from '../store/useMapStore'
import { fetchPOIsAlongRoute, OverpassAllServersFailedError, OverpassTimeoutError } from '../services/overpass'

const DEBOUNCE_MS = 800

export function usePOISearch(): void {
  const routeResult = useMapStore((s) => s.routeResult)
  const poiBuffer = useMapStore((s) => s.appSettings.poiBuffer)
  const activeCategories = useMapStore((s) => s.activeCategories)
  const { setAllPois, setIsSearchingPOI, setPOISearchError } = useMapStore((s) => s.actions)

  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!routeResult) {
      setAllPois([])
      setPOISearchError(null)
      return
    }

    const currentId = ++requestIdRef.current
    const abortController = new AbortController()

    const timerId = setTimeout(async () => {
      setIsSearchingPOI(true)
      setPOISearchError(null)

      const tier1Cats = POI_TIER1.filter((c): c is POICategory => activeCategories.includes(c))
      const tier2Cats = POI_TIER2.filter((c): c is POICategory => activeCategories.includes(c))

      // --- Tier 1 ---
      let tier1Results: POI[] = []

      if (tier1Cats.length > 0) {
        try {
          tier1Results = await fetchPOIsAlongRoute(
            routeResult.geometry,
            poiBuffer,
            tier1Cats,
            abortController.signal,
          )
          if (requestIdRef.current !== currentId) return
          setAllPois(tier1Results)
        } catch (err) {
          if (requestIdRef.current !== currentId) return
          if (abortController.signal.aborted) return

          console.error('[poi] Tier 1 fetchPOIsAlongRoute failed:', err)
          setAllPois([])

          const message =
            err instanceof OverpassAllServersFailedError
              ? 'POI search failed: all servers unavailable. Try again later.'
              : err instanceof OverpassTimeoutError
                ? 'POI search timed out. Try again later.'
                : 'POI search failed. Check your connection.'

          setPOISearchError(message)
          setIsSearchingPOI(false)
          return
        }
      }

      if (requestIdRef.current !== currentId) return

      // --- Tier 2 ---
      if (tier2Cats.length > 0) {
        try {
          const tier2Results = await fetchPOIsAlongRoute(
            routeResult.geometry,
            poiBuffer,
            tier2Cats,
            abortController.signal,
          )
          if (requestIdRef.current !== currentId) return
          setAllPois([...tier1Results, ...tier2Results])
        } catch (err) {
          if (requestIdRef.current !== currentId) return
          if (abortController.signal.aborted) return

          console.warn('[poi] Tier 2 fetchPOIsAlongRoute failed (keeping Tier 1 results):', err)
          // Keep tier1Results that were already set
          const message =
            err instanceof OverpassAllServersFailedError
              ? 'Some POIs may be missing: informational layer failed to load.'
              : err instanceof OverpassTimeoutError
                ? 'Some POIs may be missing: secondary search timed out.'
                : 'Some POIs may be missing: partial search failure.'

          setPOISearchError(message)
        }
      } else if (tier1Cats.length === 0) {
        // No categories in either tier — skip straight to done
        setAllPois([])
      }

      if (requestIdRef.current === currentId) setIsSearchingPOI(false)
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timerId)
      abortController.abort()
    }
  }, [routeResult, poiBuffer, activeCategories, setAllPois, setIsSearchingPOI, setPOISearchError])
}
