import type { POI, POICategory } from '@trailx/shared'

type LineStringGeometry = {
  type: 'LineString'
  coordinates: number[][]
}
import { POI_OVERPASS_FILTER } from '@trailx/shared'

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

let serverIndex = 0

function nextServer(): string {
  const url = OVERPASS_SERVERS[serverIndex % OVERPASS_SERVERS.length]
  serverIndex++
  return url
}

const MAX_ROUTE_POINTS = 50
const TIMEOUT_MS = 20_000

export class OverpassTimeoutError extends Error {
  constructor() {
    super('Overpass query timed out')
    this.name = 'OverpassTimeoutError'
  }
}

export class OverpassAllServersFailedError extends Error {
  name = 'OverpassAllServersFailedError'
  constructor() {
    super('All Overpass servers failed')
    this.name = 'OverpassAllServersFailedError'
  }
}

/** Uniform step sampling: reduce coords to at most maxPoints */
function thinCoords(
  coords: Array<[number, number]>,
  maxPoints: number,
): Array<[number, number]> {
  if (coords.length <= maxPoints) return coords
  const step = (coords.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, i) => coords[Math.round(i * step)])
}

/** Reverse-map an element's OSM tags to a POICategory */
function detectCategory(tags: Record<string, string>): POICategory | null {
  if (tags.amenity === 'drinking_water') return 'drinking_water'
  if (tags.amenity === 'bicycle_repair_station') return 'bicycle_repair'
  if (tags.amenity === 'shelter') return 'shelter'
  if (tags.shop === 'bicycle') return 'bicycle_shop'
  if (tags.tourism === 'camp_site') return 'camp_site'
  if (tags.amenity === 'cafe' || tags.amenity === 'restaurant' || tags.amenity === 'fast_food')
    return 'food'
  if (tags.historic) return 'historic'
  if (tags.tourism === 'viewpoint') return 'viewpoint'
  return null
}

function buildOverpassQuery(
  coordStr: string,
  bufferMetres: number,
  categories: POICategory[],
): string {
  const lines = categories.map(
    (cat) => `  node(around:${bufferMetres},${coordStr})${POI_OVERPASS_FILTER[cat]};`,
  )
  return `[out:json][timeout:15];\n(\n${lines.join('\n')}\n);\nout body;`
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

export async function fetchPOIsAlongRoute(
  routeGeometry: LineStringGeometry,
  bufferMetres: number,
  categories: POICategory[],
  signal?: AbortSignal,
): Promise<POI[]> {
  if (categories.length === 0) return []

  // geometry.coordinates are [lng, lat]; Overpass expects lat,lng
  const rawCoords = routeGeometry.coordinates as Array<[number, number]>
  const thinned = thinCoords(rawCoords, MAX_ROUTE_POINTS)
  const coordStr = thinned.map(([lng, lat]) => `${lat},${lng}`).join(',')

  const query = buildOverpassQuery(coordStr, bufferMetres, categories)

  const MAX_RETRIES = 2
  let attempt = 0

  while (attempt <= MAX_RETRIES) {
    // Abort immediately if signal is already aborted
    if (signal?.aborted) {
      throw new OverpassTimeoutError()
    }

    const serverUrl = nextServer()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    // Link external abort signal to our controller
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort)

    try {
      const response = await fetch(serverUrl, {
        method: 'POST',
        body: query,
        signal: controller.signal,
      })

      if (response.status === 429 || response.status === 503) {
        const nextUrl = OVERPASS_SERVERS[serverIndex % OVERPASS_SERVERS.length]
        console.warn(`[overpass] Server ${serverUrl} returned ${response.status}, rotating to ${nextUrl}`)
        attempt++
        continue
      }

      if (!response.ok) throw new Error(`Overpass error: ${response.status}`)

      const data = (await response.json()) as OverpassResponse
      const pois: POI[] = []

      for (const el of data.elements) {
        if (el.type !== 'node') continue
        const tags = el.tags ?? {}
        const category = detectCategory(tags)
        if (!category || !categories.includes(category)) continue
        pois.push({
          id: `osm-node-${el.id}`,
          lat: el.lat,
          lng: el.lon,
          name: tags.name,
          category,
          tags,
          osmId: el.id,
          osmType: 'node',
        })
      }

      return pois
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Check if this was due to external signal abort or our own timeout
        if (signal?.aborted) {
          throw new OverpassTimeoutError()
        }
        // Our own internal timeout — try rotating
        const nextUrl = OVERPASS_SERVERS[serverIndex % OVERPASS_SERVERS.length]
        console.warn(`[overpass] Server ${serverUrl} returned OverpassTimeoutError, rotating to ${nextUrl}`)
        attempt++
        continue
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  throw new OverpassAllServersFailedError()
}
