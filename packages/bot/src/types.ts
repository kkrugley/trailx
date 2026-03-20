/** Shape of a waypoint stored as JSON in Route.waypoints */
export interface StoredWaypoint {
  lat: number
  lng: number
  label?: string
  order: number
}
