import type { POI, POICategory } from '@trailx/shared'

type LineStringGeometry = {
  type: 'LineString'
  coordinates: number[][]
}
import { POI_OVERPASS_FILTER } from '@trailx/shared'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const MAX_ROUTE_POINTS = 200
const TIMEOUT_MS = 10_000

export class OverpassTimeoutError extends Error {
  constructor() {
    super('Overpass query timed out')
    this.name = 'OverpassTimeoutError'
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
  return `[out:json][timeout:10];\n(\n${lines.join('\n')}\n);\nout body;`
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
): Promise<POI[]> {
  if (categories.length === 0) return []

  // geometry.coordinates are [lng, lat]; Overpass expects lat,lng
  const rawCoords = routeGeometry.coordinates as Array<[number, number]>
  const thinned = thinCoords(rawCoords, MAX_ROUTE_POINTS)
  const coordStr = thinned.map(([lng, lat]) => `${lat},${lng}`).join(',')

  const query = buildOverpassQuery(coordStr, bufferMetres, categories)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: query,
      signal: controller.signal,
    })

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
      console.warn('[overpass] Query timed out after', TIMEOUT_MS, 'ms')
      throw new OverpassTimeoutError()
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
