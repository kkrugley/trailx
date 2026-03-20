const API_BASE = (import.meta as ImportMeta & { env: Record<string, string> }).env
  .VITE_API_URL ?? 'http://localhost:3000'

export interface RemoteWaypoint {
  lat: number
  lng: number
  name?: string
}

export interface RemoteRoute {
  id: string
  name: string
  waypoints: RemoteWaypoint[]
}

export async function getRoute(routeId: string): Promise<RemoteRoute> {
  const res = await fetch(`${API_BASE}/routes/${routeId}`)
  if (!res.ok) throw new Error(`Failed to fetch route "${routeId}": ${res.status}`)
  return res.json() as Promise<RemoteRoute>
}
