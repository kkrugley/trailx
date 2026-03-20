export interface Waypoint {
  id: string
  lat: number
  lng: number
  label?: string
  address?: string
}

export interface RoutePoint extends Waypoint {
  order: number
  type: 'start' | 'end' | 'intermediate'
}
