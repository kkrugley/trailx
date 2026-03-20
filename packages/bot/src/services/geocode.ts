interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; city?: string; country?: string }
}

interface PhotonResponse {
  features: PhotonFeature[]
}

export interface GeocodedPlace {
  lat: number
  lng: number
  name: string
}

export async function geocode(query: string): Promise<GeocodedPlace | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as PhotonResponse
    const feature = data.features[0]
    if (!feature) return null
    const [lng, lat] = feature.geometry.coordinates
    const name =
      feature.properties.name ?? feature.properties.city ?? query
    return { lat, lng, name }
  } catch {
    return null
  }
}
