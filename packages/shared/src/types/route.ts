import type { LineString } from 'geojson'

export interface RouteResult {
  geometry: LineString
  distance: number   // metres
  duration: number   // seconds
  elevation: number[] // elevation per track point, same length as geometry.coordinates
  surface?: string[]   // surface type per point (asphalt, gravel, dirt…)
  roadClass?: string[] // road class per point (primary, track, cycleway…)
}

export type RoutingProfile = 'foot' | 'bike' | 'mtb' | 'racingbike'
