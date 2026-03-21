// ── POI image service ─────────────────────────────────────────────────────────
// Sources tried in order: Wikidata → Mapillary → placeholder
// Flickr: disabled (requires paid account) — uncomment when ready
// Sequential is intentional: best-quality sources first.

export interface POIImageResult {
  url: string
  source: 'wikidata' | 'flickr' | 'mapillary' | 'placeholder'
}

// ── Internal response shapes ──────────────────────────────────────────────────

interface WikidataClaim {
  mainsnak: { datavalue: { value: string } }
}
interface WikidataResponse {
  claims?: { P18?: WikidataClaim[] }
}

// interface FlickrPhoto { url_z?: string }
// interface FlickrResponse { photos?: { photo: FlickrPhoto[] } }

interface MapillaryImage {
  thumb_256_url?: string
}
interface MapillaryResponse {
  data?: MapillaryImage[]
}

// ── Wikidata ──────────────────────────────────────────────────────────────────

export async function fetchWikidataImage(wikidataId: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: 'wbgetclaims',
      entity: wikidataId,
      property: 'P18',
      format: 'json',
      origin: '*',
    })
    const res = await fetch(`https://www.wikidata.org/w/api.php?${params.toString()}`)
    const data = (await res.json()) as WikidataResponse
    const filename = data.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    if (!filename) return null
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=600`
  } catch {
    return null
  }
}

// ── Flickr (disabled — requires paid account) ─────────────────────────────────
//
// export async function fetchFlickrImages(
//   lat: number,
//   lon: number,
//   tags: Record<string, string>
// ): Promise<string[]> {
//   try {
//     const apiKey = import.meta.env.VITE_FLICKR_API_KEY as string | undefined
//     if (!apiKey) return []
//
//     const keyword = tags['historic'] ?? tags['natural'] ?? tags['tourism'] ?? tags['amenity']
//
//     const params = new URLSearchParams({
//       method: 'flickr.photos.search',
//       api_key: apiKey,
//       lat: String(lat),
//       lon: String(lon),
//       radius: '0.1',
//       license: '1,2,4,5,6,9,10',
//       sort: 'interestingness-desc',
//       per_page: '4',
//       format: 'json',
//       nojsoncallback: '1',
//       extras: 'url_z',
//     })
//     if (keyword) params.set('tags', keyword)
//
//     const res = await fetch(`https://api.flickr.com/services/rest/?${params.toString()}`)
//     const data = (await res.json()) as FlickrResponse
//     return (data.photos?.photo ?? [])
//       .map((p) => p.url_z ?? '')
//       .filter((u) => u.length > 0)
//   } catch {
//     return []
//   }
// }

// ── Mapillary ─────────────────────────────────────────────────────────────────

export async function fetchMapillaryImage(lat: number, lon: number): Promise<string | null> {
  try {
    const token = import.meta.env.VITE_MAPILLARY_TOKEN as string | undefined
    if (!token) return null

    const delta = 0.002 // ~220m radius — better Mapillary coverage than 0.0005
    const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`
    const params = new URLSearchParams({
      access_token: token,
      fields: 'id,thumb_256_url',
      bbox,
      limit: '1',
    })

    const res = await fetch(`https://graph.mapillary.com/images?${params.toString()}`)
    const data = (await res.json()) as MapillaryResponse
    return data.data?.[0]?.thumb_256_url ?? null
  } catch {
    return null
  }
}

// ── Placeholder ───────────────────────────────────────────────────────────────

export function getCategoryPlaceholder(tags: Record<string, string>): string {
  const keyword =
    tags['historic'] ?? tags['natural'] ?? tags['tourism'] ?? tags['amenity'] ?? 'landscape'
  // source.unsplash.com is deprecated; picsum gives a stable seed-based photo
  return `https://picsum.photos/seed/${encodeURIComponent(keyword)}/600/338`
}

// ── Async generator — sequential, intentional ─────────────────────────────────

export async function* streamPOIImages(poi: {
  lat: number
  lon: number
  tags: Record<string, string>
}): AsyncGenerator<POIImageResult> {
  // 1. Wikidata
  if (poi.tags['wikidata']) {
    const url = await fetchWikidataImage(poi.tags['wikidata'])
    if (url) yield { url, source: 'wikidata' }
  }

  // 2. Flickr — disabled, uncomment when paid account is ready
  // const flickrUrls = await fetchFlickrImages(poi.lat, poi.lon, poi.tags)
  // for (const url of flickrUrls) {
  //   yield { url, source: 'flickr' }
  // }

  // 3. Mapillary
  const mapillaryUrl = await fetchMapillaryImage(poi.lat, poi.lon)
  if (mapillaryUrl) yield { url: mapillaryUrl, source: 'mapillary' }
}
