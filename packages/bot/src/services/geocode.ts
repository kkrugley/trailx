const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const NOMINATIM_EMAIL = 'trailx@app'

export interface GeocodedPlace {
  lat: number
  lng: number
  name: string
}

interface Waypoint {
  lat: number
  lng: number
}

interface NominatimAddress {
  name?: string
  amenity?: string
  tourism?: string
  leisure?: string
  natural?: string
  road?: string
  pedestrian?: string
  footway?: string
  cycleway?: string
  path?: string
  house_number?: string
  city?: string
  town?: string
  village?: string
  suburb?: string
  municipality?: string
  quarter?: string
  county?: string
  country?: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address: NominatimAddress
}

// ── Global throttle: max 1 req/sec per Nominatim usage policy ────────────────
let lastCallTime = 0
const THROTTLE_INTERVAL_MS = 1000

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const wait = Math.max(0, lastCallTime + THROTTLE_INTERVAL_MS - now)
  lastCallTime = now + wait
  return new Promise<T>((resolve, reject) =>
    setTimeout(() => fn().then(resolve, reject), wait),
  )
}

function shortLabel(address: NominatimAddress, fallback?: string): string | null {
  const city =
    address.city ??
    address.town ??
    address.village ??
    (address.suburb && isNaN(Number(address.suburb)) ? address.suburb : undefined) ??
    address.municipality

  const poiName =
    address.name ??
    address.amenity ??
    address.tourism ??
    address.leisure ??
    address.natural

  if (poiName) {
    const road =
      address.road ??
      address.pedestrian ??
      address.footway ??
      address.cycleway ??
      address.path
    const streetHint = road
      ? address.house_number ? `${road} ${address.house_number}` : road
      : null
    const parts = [streetHint, city].filter(Boolean)
    return parts.length > 0 ? `${poiName}, ${parts.join(', ')}` : poiName
  }

  const road =
    address.road ??
    address.pedestrian ??
    address.footway ??
    address.cycleway ??
    address.path

  if (road) {
    const streetAddr = address.house_number
      ? `${road} ${address.house_number}`
      : road
    return city ? `${streetAddr}, ${city}` : streetAddr
  }

  const place = address.quarter ?? address.suburb ?? address.village ?? address.town ?? address.city
  if (place) return place

  if (fallback) return fallback.split(',')[0].trim()
  return null
}

function buildLabel(result: NominatimResult): string {
  const a = result.address

  const city = a.city ?? a.town ?? a.village ?? a.suburb ?? a.municipality

  const poiName = a.name ?? a.amenity ?? a.tourism ?? a.leisure ?? a.natural

  if (poiName) {
    const road = a.road ?? a.pedestrian ?? a.footway
    const streetHint = road
      ? a.house_number ? `${road} ${a.house_number}` : road
      : null
    const context = [streetHint, city].filter(Boolean).join(', ')
    return context ? `${poiName} — ${context}` : poiName
  }

  const road = a.road ?? a.pedestrian ?? a.footway ?? a.cycleway ?? a.path
  if (road) {
    const streetAddr = a.house_number ? `${road} ${a.house_number}` : road
    return city ? `${streetAddr}, ${city}` : streetAddr
  }

  return result.display_name.split(',').slice(0, 2).join(',').trim()
}

async function nominatimFetch(params: URLSearchParams): Promise<NominatimResult[]> {
  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`)
  if (!res.ok) {
    console.error('[geocode] Nominatim returned', res.status)
    return []
  }
  return (await res.json()) as NominatimResult[]
}

function baseParams(query: string, routeWaypoints?: Waypoint[]): URLSearchParams {
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
    const pad = 0.05
    params.set('viewbox', [
      Math.min(...lngs) - pad,
      Math.min(...lats) - pad,
      Math.max(...lngs) + pad,
      Math.max(...lats) + pad,
    ].join(','))
    params.set('bounded', '0')
  }

  return params
}

/**
 * Reorder heuristic for "city street house" → "street house, city" format.
 * Nominatim parses comma-separated queries significantly better for Cyrillic
 * addresses where the city comes first.
 */
function reorderQuery(query: string): string | null {
  const tokens = query.trim().split(/\s+/)
  // Only apply to 2–4 token queries without commas
  if (tokens.length < 2 || tokens.length > 4 || query.includes(',')) return null
  // Move first token (likely city) to end after a comma
  const [city, ...rest] = tokens
  return `${rest.join(' ')}, ${city}`
}

/**
 * Build structured params when input looks like "city street housenumber".
 * Treats first token as city, rest as street address.
 */
function structuredParams(query: string, routeWaypoints?: Waypoint[]): URLSearchParams | null {
  const tokens = query.trim().split(/\s+/)
  if (tokens.length < 2 || tokens.length > 4 || query.includes(',')) return null

  const [city, ...streetParts] = tokens
  const params = new URLSearchParams({
    format: 'json',
    street: streetParts.join(' '),
    city,
    limit: '5',
    'accept-language': 'ru,en',
    email: NOMINATIM_EMAIL,
    addressdetails: '1',
  })

  if (routeWaypoints && routeWaypoints.length > 0) {
    const lats = routeWaypoints.map((w) => w.lat)
    const lngs = routeWaypoints.map((w) => w.lng)
    const pad = 0.05
    params.set('viewbox', [
      Math.min(...lngs) - pad,
      Math.min(...lats) - pad,
      Math.max(...lngs) + pad,
      Math.max(...lats) + pad,
    ].join(','))
    params.set('bounded', '0')
  }

  return params
}

/**
 * Forward geocoding via Nominatim with 3-attempt cascade.
 *
 * Attempt 1: raw query as-is.
 * Attempt 2: reordered "street house, city" form (helps Cyrillic "city street house" patterns).
 * Attempt 3: structured street= + city= params.
 *
 * If routeWaypoints provided, applies a viewbox soft bias on all attempts.
 */
export async function geocode(
  query: string,
  routeWaypoints?: Waypoint[],
): Promise<GeocodedPlace[]> {
  if (!query.trim()) return []

  return throttle(async () => {
    try {
      // Attempt 1 — original query
      let data = await nominatimFetch(baseParams(query, routeWaypoints))
      if (data.length > 0) {
        return data.map((r) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), name: buildLabel(r) }))
      }

      // Attempt 2 — reordered form (city → end)
      const reordered = reorderQuery(query)
      if (reordered) {
        console.log(`[geocode] attempt 2 (reordered): "${reordered}"`)
        data = await nominatimFetch(baseParams(reordered, routeWaypoints))
        if (data.length > 0) {
          return data.map((r) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), name: buildLabel(r) }))
        }
      }

      // Attempt 3 — structured street + city
      const structured = structuredParams(query, routeWaypoints)
      if (structured) {
        console.log(`[geocode] attempt 3 (structured): street="${structured.get('street')}" city="${structured.get('city')}"`)
        data = await nominatimFetch(structured)
        if (data.length > 0) {
          return data.map((r) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), name: buildLabel(r) }))
        }
      }

      return []
    } catch (err) {
      console.error('[geocode] Nominatim fetch error:', err)
      return []
    }
  })
}

/**
 * Reverse geocoding via Nominatim — returns a short human-readable label.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  return throttle(async () => {
    try {
      const params = new URLSearchParams({
        format: 'json',
        lat: String(lat),
        lon: String(lng),
        zoom: '16',
        addressdetails: '1',
        'accept-language': 'ru,en',
        email: NOMINATIM_EMAIL,
      })
      const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`)
      if (!res.ok) {
        console.error('[reverseGeocode] Nominatim returned', res.status)
        return null
      }
      const data = (await res.json()) as { display_name?: string; address?: NominatimAddress }
      return shortLabel(data.address ?? {}, data.display_name) ?? null
    } catch (err) {
      console.error('[reverseGeocode] Nominatim fetch error:', err)
      return null
    }
  })
}
