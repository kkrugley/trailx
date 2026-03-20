export interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name: string
    country?: string
    city?: string
    street?: string
    housenumber?: string
    state?: string
    type?: string
    osm_value?: string
  }
}

export interface SearchResult {
  lat: number
  lng: number
  name: string
  address: string
  type: string
}

interface PhotonResponse {
  features: PhotonFeature[]
}

export async function searchPhoton(
  query: string,
  signal?: AbortSignal,
): Promise<PhotonFeature[]> {
  if (!query.trim()) return []

  const params = new URLSearchParams({ q: query.trim(), lang: 'en', limit: '5' })
  const url = `https://photon.komoot.io/api/?${params.toString()}`

  try {
    const response = await fetch(url, { signal })
    if (!response.ok) return []
    const data = (await response.json()) as PhotonResponse
    return data.features ?? []
  } catch {
    // Network error, abort, or any other failure — degrade gracefully
    return []
  }
}

export function photonFeatureLabel(feature: PhotonFeature): string {
  const p = feature.properties
  const parts: string[] = []
  if (p.name) parts.push(p.name)
  if (p.street && p.housenumber) parts.push(`${p.street} ${p.housenumber}`)
  else if (p.street) parts.push(p.street)
  if (p.city) parts.push(p.city)
  if (p.country) parts.push(p.country)
  return parts.join(', ') || 'Unknown location'
}

/** Legacy helper used by SearchBar */
export async function searchPlaces(query: string): Promise<SearchResult[]> {
  const features = await searchPhoton(query)
  return features.map((f) => ({
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    name: f.properties.name ?? f.properties.street ?? query,
    address: [
      f.properties.street && f.properties.housenumber
        ? `${f.properties.street} ${f.properties.housenumber}`
        : f.properties.street,
      f.properties.city,
      f.properties.country,
    ]
      .filter(Boolean)
      .join(', '),
    type: f.properties.type ?? f.properties.osm_value ?? 'place',
  }))
}
