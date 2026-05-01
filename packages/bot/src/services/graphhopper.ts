export type GHProfile = 'bike' | 'racingbike' | 'mtb' | 'foot'

export interface RouteResult {
  /** GeoJSON coordinate order: [lng, lat, ele?] */
  coords: Array<[number, number, number?]>
  distanceKm: number
  ascent: number
}

export class GraphHopperError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message)
    this.name = 'GraphHopperError'
  }
}

/**
 * Route a sequence of waypoints via the GraphHopper Routing API.
 * Returns decoded GeoJSON coordinates + distance + ascent.
 * Throws GraphHopperError on API failure.
 */
export async function routeWaypoints(
  points: Array<[lat: number, lng: number]>,
  profile: GHProfile,
): Promise<RouteResult> {
  const apiKey = process.env.GRAPHHOPPER_API_KEY
  if (!apiKey) throw new GraphHopperError('GRAPHHOPPER_API_KEY is not set')

  const body = {
    points: points.map(([lat, lng]) => [lng, lat]), // GH expects [lng, lat]
    profile,
    points_encoded: false,
    elevation: true,
    instructions: false,
    locale: 'en',
  }

  const res = await fetch(`https://graphhopper.com/api/1/route?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (res.status === 429) throw new GraphHopperError('Rate limit exceeded', 429)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new GraphHopperError(`GraphHopper error ${res.status}: ${text}`, res.status)
  }

  const data = (await res.json()) as {
    paths?: Array<{
      points: { coordinates: Array<[number, number, number?]> }
      distance: number
      ascend?: number
    }>
    message?: string
  }

  const path = data.paths?.[0]
  if (!path) throw new GraphHopperError(data.message ?? 'No route found')

  return {
    coords: path.points.coordinates,
    distanceKm: Math.round((path.distance / 1000) * 10) / 10,
    ascent: Math.round(path.ascend ?? 0),
  }
}
