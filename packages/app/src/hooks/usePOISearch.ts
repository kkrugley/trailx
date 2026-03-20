import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'
import { fetchPOIsAlongRoute } from '../services/overpass'

const DEBOUNCE_MS = 800
const BUFFER_METRES = 500

export function usePOISearch(): void {
  const routeResult = useMapStore((s) => s.routeResult)
  const activeCategories = useMapStore((s) => s.activeCategories)
  const { setPois, setIsSearchingPOI } = useMapStore((s) => s.actions)

  // Track in-flight request to ignore stale responses
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!routeResult || activeCategories.length === 0) {
      setPois([])
      return
    }

    const currentId = ++requestIdRef.current
    const timerId = setTimeout(async () => {
      setIsSearchingPOI(true)
      try {
        const found = await fetchPOIsAlongRoute(
          routeResult.geometry,
          BUFFER_METRES,
          activeCategories,
        )
        if (requestIdRef.current !== currentId) return
        setPois(found)
      } catch (err) {
        if (requestIdRef.current !== currentId) return
        console.error('[poi] fetchPOIsAlongRoute failed:', err)
        setPois([])
      } finally {
        if (requestIdRef.current === currentId) setIsSearchingPOI(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timerId)
  }, [routeResult, activeCategories, setPois, setIsSearchingPOI])
}
