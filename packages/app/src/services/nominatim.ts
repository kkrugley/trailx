const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
// email= param used as identification per Nominatim usage policy
// (browsers block User-Agent header in fetch)
const NOMINATIM_EMAIL = 'trailx@app'

export interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
  address: Partial<Record<string, string>>
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

/** Forward geocoding — returns up to 5 matching places */
export async function searchNominatim(
  query: string,
  signal?: AbortSignal,
): Promise<NominatimResult[]> {
  if (!query.trim()) return []
  return throttle(async () => {
    try {
      const params = new URLSearchParams({
        format: 'json',
        q: query.trim(),
        limit: '5',
        'accept-language': 'ru,en',
        email: NOMINATIM_EMAIL,
      })
      const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, { signal })
      if (!res.ok) return []
      return (await res.json()) as NominatimResult[]
    } catch {
      return []
    }
  })
}

/** Reverse geocoding — returns a short place name for given coordinates */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
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
      const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, { signal })
      if (!res.ok) return null
      const data = (await res.json()) as { display_name?: string; address?: Partial<Record<string, string>> }
      return shortLabel(data.address, data.display_name) ?? null
    } catch {
      return null
    }
  })
}

/**
 * Build a short human-readable label from a Nominatim address object.
 * Priority: named POI > street+housenumber > suburb/place > fallback.
 */
export function shortLabel(
  address: Partial<Record<string, string>> | undefined,
  fallback?: string,
): string | null {
  if (address) {
    const city =
      address.city ??
      address.town ??
      address.village ??
      address.suburb ??
      address.municipality

    // Named place (café, shop, landmark, etc.)
    const poiName =
      address.name ??
      address.amenity ??
      address.tourism ??
      address.leisure ??
      address.natural

    if (poiName) {
      return city && city !== poiName ? `${poiName}, ${city}` : poiName
    }

    // Street address (road + optional house number)
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

    // Last resort: suburb / place name
    const place = address.quarter ?? address.suburb ?? address.village ?? address.town ?? address.city
    if (place) return place
  }
  if (fallback) return fallback.split(',')[0].trim()
  return null
}

/**
 * Format a NominatimResult for display in the suggestion dropdown.
 * Produces a two-part label: primary part + optional city context.
 */
export function nominatimLabel(result: NominatimResult): string {
  const a = result.address

  const city =
    a?.city ?? a?.town ?? a?.village ?? a?.suburb ?? a?.municipality

  const poiName = a?.name ?? a?.amenity ?? a?.tourism ?? a?.leisure ?? a?.natural

  if (poiName) {
    const road = a?.road ?? a?.pedestrian ?? a?.footway
    const streetHint = road
      ? a?.house_number
        ? `${road} ${a.house_number}`
        : road
      : null
    const context = [streetHint, city].filter(Boolean).join(', ')
    return context ? `${poiName} — ${context}` : poiName
  }

  const road = a?.road ?? a?.pedestrian ?? a?.footway ?? a?.cycleway ?? a?.path
  if (road) {
    const streetAddr = a?.house_number ? `${road} ${a.house_number}` : road
    return city ? `${streetAddr}, ${city}` : streetAddr
  }

  // Fallback: first two comma-separated parts of display_name
  return result.display_name.split(',').slice(0, 2).join(',').trim()
}
