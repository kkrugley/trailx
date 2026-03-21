import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'
import { fetchPOIsAlongRoute } from '../services/overpass'
import { POI_CATEGORIES } from '@trailx/shared'

const DEBOUNCE_MS = 800

export function usePOISearch(): void {
  const routeResult = useMapStore((s) => s.routeResult)
  const poiBuffer = useMapStore((s) => s.appSettings.poiBuffer)
  const { setAllPois, setIsSearchingPOI } = useMapStore((s) => s.actions)

  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!routeResult) {
      setAllPois([])
      return
    }

    const currentId = ++requestIdRef.current
    const timerId = setTimeout(async () => {
      setIsSearchingPOI(true)
      try {
        // Always fetch all categories — filtering is done client-side
        const found = await fetchPOIsAlongRoute(
          routeResult.geometry,
          poiBuffer,
          [...POI_CATEGORIES],
        )
        if (requestIdRef.current !== currentId) return
        setAllPois(found)
      } catch (err) {
        if (requestIdRef.current !== currentId) return
        console.error('[poi] fetchPOIsAlongRoute failed:', err)
        setAllPois([])
      } finally {
        if (requestIdRef.current === currentId) setIsSearchingPOI(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timerId)
  }, [routeResult, poiBuffer, setAllPois, setIsSearchingPOI])
}
