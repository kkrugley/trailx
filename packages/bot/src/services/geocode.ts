const PHOTON_BASE = 'https://photon.komoot.io'

export interface GeocodedPlace {
  lat: number
  lng: number
  name: string
}

interface Waypoint {
  lat: number
  lng: number
}

interface PhotonProperties {
  name?: string
  street?: string
  housenumber?: string
  city?: string
  town?: string
  village?: string
  county?: string
  country?: string
  type?: string
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: PhotonProperties
}

interface PhotonResponse {
  features: PhotonFeature[]
}

function buildLabel(p: PhotonProperties): string {
  const poi = p.name
  const road = p.street
  const house = p.housenumber
  const city = p.city ?? p.town ?? p.village ?? p.county

  if (poi && poi !== road) {
    const streetPart = road ? (house ? `${road} ${house}` : road) : null
    const context = [streetPart, city].filter(Boolean).join(', ')
    return context ? `${poi} — ${context}` : poi
  }

  if (road) {
    const streetAddr = house ? `${road} ${house}` : road
    return city ? `${streetAddr}, ${city}` : streetAddr
  }

  return city ?? p.country ?? 'Unknown'
}

/**
 * Forward geocoding via Photon (Komoot).
 * If routeWaypoints provided, applies a bbox soft bias.
 */
export async function geocode(
  query: string,
  routeWaypoints?: Waypoint[],
): Promise<GeocodedPlace[]> {
  if (!query.trim()) return []

  const params = new URLSearchParams({
    q: query.trim(),
    lang: 'ru',
    limit: '5',
  })

  if (routeWaypoints && routeWaypoints.length > 0) {
    const lats = routeWaypoints.map((w) => w.lat)
    const lngs = routeWaypoints.map((w) => w.lng)
    const pad = 0.05
    params.set('bbox', [
      Math.min(...lngs) - pad,
      Math.min(...lats) - pad,
      Math.max(...lngs) + pad,
      Math.max(...lats) + pad,
    ].join(','))
  }

  try {
    const res = await fetch(`${PHOTON_BASE}/api/?${params}`)
    if (!res.ok) {
      console.error('[geocode] Photon returned', res.status)
      return []
    }
    const data = (await res.json()) as PhotonResponse
    return data.features.map((f) => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      name: buildLabel(f.properties),
    }))
  } catch (err) {
    console.error('[geocode] Photon fetch error:', err)
    return []
  }
}

/**
 * Reverse geocoding via Photon — returns a short human-readable label.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      lang: 'ru',
    })
    const res = await fetch(`${PHOTON_BASE}/reverse?${params}`)
    if (!res.ok) {
      console.error('[reverseGeocode] Photon returned', res.status)
      return null
    }
    const data = (await res.json()) as PhotonResponse
    if (!data.features.length) return null
    return buildLabel(data.features[0].properties)
  } catch (err) {
    console.error('[reverseGeocode] Photon fetch error:', err)
    return null
  }
}
