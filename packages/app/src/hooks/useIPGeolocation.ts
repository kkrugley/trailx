import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { MapViewHandle } from '../components/MapView/MapView'
import { useMapStore } from '../store/useMapStore'

export function useIPGeolocation(mapRef: RefObject<MapViewHandle | null>) {
  const waypoints = useMapStore((s) => s.waypoints)
  const hasRoute = waypoints.some((wp) => !isNaN(wp.lat))
  const ranRef = useRef(false)

  useEffect(() => {
    if (hasRoute || ranRef.current) return
    ranRef.current = true

    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 3000)

    fetch('https://ipapi.co/json/', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        const { latitude, longitude } = data as { latitude: number; longitude: number }
        if (typeof latitude === 'number' && typeof longitude === 'number') {
          mapRef.current?.getMap()?.flyTo({ center: [longitude, latitude], zoom: 9 })
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
