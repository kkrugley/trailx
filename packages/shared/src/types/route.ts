import type { LineString } from 'geojson'

export interface RouteResult {
  geometry: LineString
  distance: number   // metres
  duration: number   // seconds
  elevation: number[] // elevation per track point, same length as geometry.coordinates
}

export type RoutingProfile = 'bike' | 'racingbike' | 'foot'
