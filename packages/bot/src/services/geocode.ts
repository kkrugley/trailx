const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const NOMINATIM_EMAIL = 'trailx@app'

// 1 req/sec throttle per Nominatim usage policy
let lastCallTime = 0

function throttledFetch(url: string): Promise<Response> {
  const now = Date.now()
  const wait = Math.max(0, lastCallTime + 1000 - now)
  lastCallTime = now + wait
  return new Promise((resolve, reject) =>
    setTimeout(() => fetch(url).then(resolve, reject), wait),
  )
}

export interface GeocodedPlace {
  lat: number
  lng: number
  name: string
}

interface Waypoint {
  lat: number
  lng: number
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: Partial<Record<string, string>>
}

function buildLabel(result: NominatimResult): string {
  const a = result.address
  if (!a) return result.display_name.split(',').slice(0, 2).join(',').trim()

  const city = a.city ?? a.town ?? a.village ?? a.suburb ?? a.municipality
  const poi = a.name ?? a.amenity ?? a.tourism ?? a.leisure ?? a.natural

  if (poi) {
    const road = a.road ?? a.pedestrian ?? a.footway
    const streetHint = road
      ? a.house_number
        ? `${road} ${a.house_number}`
        : road
      : null
    const context = [streetHint, city].filter(Boolean).join(', ')
    return context ? `${poi} — ${context}` : poi
  }

  const road = a.road ?? a.pedestrian ?? a.footway ?? a.cycleway ?? a.path
  if (road) {
    const streetAddr = a.house_number ? `${road} ${a.house_number}` : road
    return city ? `${streetAddr}, ${city}` : streetAddr
  }

  return result.display_name.split(',').slice(0, 2).join(',').trim()
}

/**
 * Search for places using Nominatim.
 * If routeWaypoints are provided, applies a soft geographic bias toward the
 * route's bounding box (results outside the box are still returned if nothing
 * is found inside).
 */
export async function geocode(
  query: string,
  routeWaypoints?: Waypoint[],
): Promise<GeocodedPlace[]> {
  if (!query.trim()) return []

  const params = new URLSearchParams({
    format: 'json',
    q: query.trim(),
    limit: '5',
    'accept-language': 'ru,en',
    email: NOMINATIM_EMAIL,
    addressdetails: '1',
  })

  if (routeWaypoints && routeWaypoints.length > 0) {
    const lats = routeWaypoints.map((w) => w.lat)
    const lngs = routeWaypoints.map((w) => w.lng)
    const pad = 0.05 // ~5 km
    const minLng = Math.min(...lngs) - pad
    const minLat = Math.min(...lats) - pad
    const maxLng = Math.max(...lngs) + pad
    const maxLat = Math.max(...lats) + pad
    // Nominatim viewbox: left(minLng), top(maxLat), right(maxLng), bottom(minLat)
    params.set('viewbox', `${minLng},${maxLat},${maxLng},${minLat}`)
    params.set('bounded', '0') // soft bias — still return results outside box
  }

  try {
    const res = await throttledFetch(`${NOMINATIM_BASE}/search?${params}`)
    if (!res.ok) return []
    const results = (await res.json()) as NominatimResult[]
    return results.map((r) => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      name: buildLabel(r),
    }))
  } catch {
    return []
  }
}
