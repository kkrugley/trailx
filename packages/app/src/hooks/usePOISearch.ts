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

      if (tier1Cats.length === 0 && tier2Cats.length === 0) {
        setAllPois([])
        setIsSearchingPOI(false)
        return
      }

      // Run both tiers in parallel — each uses a different server via round-robin
      const [tier1Result, tier2Result] = await Promise.allSettled([
        tier1Cats.length > 0
          ? fetchPOIsAlongRoute(routeResult.geometry, poiBuffer, tier1Cats, abortController.signal)
          : Promise.resolve([] as POI[]),
        tier2Cats.length > 0
          ? fetchPOIsAlongRoute(routeResult.geometry, poiBuffer, tier2Cats, abortController.signal)
          : Promise.resolve([] as POI[]),
      ])

      if (requestIdRef.current !== currentId) return
      if (abortController.signal.aborted) return

      const tier1Pois = tier1Result.status === 'fulfilled' ? tier1Result.value : []
      const tier2Pois = tier2Result.status === 'fulfilled' ? tier2Result.value : []

      setAllPois([...tier1Pois, ...tier2Pois])

      // Surface errors
      if (tier1Result.status === 'rejected' && tier2Result.status === 'rejected') {
        console.error('[poi] Both tiers failed:', tier1Result.reason)
        const message =
          tier1Result.reason instanceof OverpassAllServersFailedError
            ? 'POI search failed: all servers unavailable. Try again later.'
            : tier1Result.reason instanceof OverpassTimeoutError
              ? 'POI search timed out. Try again later.'
              : 'POI search failed. Check your connection.'
        setPOISearchError(message)
      } else if (tier1Result.status === 'rejected') {
        console.warn('[poi] Tier 1 failed (keeping Tier 2 results):', tier1Result.reason)
        setPOISearchError('Some POIs may be missing: critical layer failed to load.')
      } else if (tier2Result.status === 'rejected') {
        console.warn('[poi] Tier 2 failed (keeping Tier 1 results):', tier2Result.reason)
        setPOISearchError('Some POIs may be missing: informational layer failed to load.')
      } else {
        setPOISearchError(null)
      }

      if (requestIdRef.current === currentId) setIsSearchingPOI(false)
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timerId)
      abortController.abort()
    }
  }, [routeResult, poiBuffer, activeCategories, setAllPois, setIsSearchingPOI, setPOISearchError])
}
