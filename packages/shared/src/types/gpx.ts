export interface GPXTrackPoint {
  lat: number
  lng: number
  ele?: number
  time?: string
}

export interface GPXTrack {
  name?: string
  points: GPXTrackPoint[]
}

export interface GPXWaypoint {
  lat: number
  lng: number
  name?: string
  description?: string
  ele?: number
}

export interface GPXFile {
  name?: string
  tracks: GPXTrack[]
  waypoints: GPXWaypoint[]
}
