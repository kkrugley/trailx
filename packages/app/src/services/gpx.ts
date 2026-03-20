import type { GPXTrack, GPXWaypoint } from '@trailx/shared'
import { serializeGPX } from '@trailx/shared'
import { useMapStore } from '../store/useMapStore'

/**
 * Export the current route + standalone POIs as a GPX file download.
 * No-op if no route has been calculated.
 */
export function exportRoute(): void {
  const { routeResult, standalonePois } = useMapStore.getState()
  if (!routeResult) return

  const coords = routeResult.geometry.coordinates as Array<[number, number]>

  const track: GPXTrack = {
    name: 'TrailX Route',
    points: coords.map(([lng, lat], i) => ({
      lat,
      lng,
      ele: routeResult.elevation[i],
    })),
  }

  const waypoints: GPXWaypoint[] = standalonePois.map((poi) => ({
    lat: poi.lat,
    lng: poi.lng,
    name: poi.name,
  }))

  const gpxString = serializeGPX(track, waypoints, 'TrailX Route')
  const blob = new Blob([gpxString], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `trailx-${Date.now()}.gpx`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
