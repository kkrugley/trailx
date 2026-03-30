import type { POI, POICategory } from '@trailx/shared'
import { POI_OVERPASS_FILTER } from '@trailx/shared'
import type { Feature, Point } from 'geojson'
import { getDB, dbAvailable, TILE_EXPIRY_MS } from '../db'
import {
  bboxToTiles,
  tileToBbox,
  expandBbox,
  pointToPolylineDistanceM,
  QUERY_ZOOM,
} from '../utils/tiles'

type LineStringGeometry = {
  type: 'LineString'
  coordinates: number[][]
}

// Multi-server failover (round-robin).
// maps.mail.ru is excluded — it is blocked by Firefox Enhanced Tracking Protection
// and enforces a strict CORS policy that rejects browser requests.
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
let serverIndex = 0

function nextServer(): string {
  const url = OVERPASS_SERVERS[serverIndex % OVERPASS_SERVERS.length]
  serverIndex++
  return url
}

/** Reduce coords array to at most `max` evenly-sampled points, always keeping first and last. */
function thinCoords(coords: number[][], max: number): number[][] {
  if (coords.length <= max) return coords
  const result: number[][] = []
  const step = (coords.length - 1) / (max - 1)
  for (let i = 0; i < max; i++) {
    result.push(coords[Math.round(i * step)])
  }
  return result
}

export class OverpassTimeoutError extends Error {
  constructor() {
    super('Overpass query timed out')
    this.name = 'OverpassTimeoutError'
  }
}

// Public Overpass instances under load can take 15-25s to respond.
// 10s was too tight and caused spurious timeouts for slow-but-valid responses.
const TILE_QUERY_TIMEOUT_MS = 25_000
const MAX_CONCURRENT = 5

/** Delays in ms for successive retry attempts on 429/503 responses. */
const BACKOFF_DELAYS_MS: readonly number[] = [1000, 2000]

/** Wait `ms` milliseconds, rejecting early (as AbortError) if `signal` fires. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
  }
  return new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id)
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
      },
      { once: true },
    )
  })
}

/** Reverse-map an element's OSM tags to a POICategory */
export function detectCategory(tags: Record<string, string>): POICategory | null {
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

/** Build Overpass QL for a bbox and set of categories */
function buildTileQuery(
  south: number,
  west: number,
  north: number,
  east: number,
  categories: POICategory[],
): string {
  const lines = categories
    .filter((c) => POI_OVERPASS_FILTER[c])
    .map((c) => `  nwr(${south},${west},${north},${east})${POI_OVERPASS_FILTER[c]};`)
  return `[out:json][timeout:10];\n(\n${lines.join('\n')}\n);\nout center;`
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

/**
 * Fetch a single tile from Overpass and return raw GeoJSON features.
 * Retries up to BACKOFF_DELAYS_MS.length times on 429/503 with exponential backoff.
 * Hard-fails immediately on 403/504. Aborts cleanly when `signal` fires.
 */
async function fetchTile(
  x: number,
  y: number,
  categories: POICategory[],
  signal: AbortSignal,
): Promise<Feature<Point>[]> {
  const [west, south, east, north] = tileToBbox(x, y, QUERY_ZOOM)
  const query = buildTileQuery(south, west, north, east, categories)

  for (let attempt = 0; attempt <= BACKOFF_DELAYS_MS.length; attempt++) {
    if (signal.aborted) throw new OverpassTimeoutError()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TILE_QUERY_TIMEOUT_MS)
    const onOuterAbort = () => controller.abort()
    signal.addEventListener('abort', onOuterAbort, { once: true })

    try {
      const res = await fetch(nextServer(), {
        method: 'POST',
        body: query,
        signal: controller.signal,
      })

      if (!res.ok) {
        if ((res.status === 429 || res.status === 503) && attempt < BACKOFF_DELAYS_MS.length) {
          // Rate-limited — back off before retrying on a different server
          clearTimeout(timeoutId)
          signal.removeEventListener('abort', onOuterAbort)
          await sleep(BACKOFF_DELAYS_MS[attempt], signal)
          continue
        }
        throw new Error(`Overpass HTTP ${res.status}`)
      }

      const data = (await res.json()) as OverpassResponse
      const features: Feature<Point>[] = []

      for (const el of data.elements) {
        const tags = el.tags ?? {}
        const category = detectCategory(tags)
        if (!category) continue

        const lat = el.lat ?? el.center?.lat
        const lon = el.lon ?? el.center?.lon
        if (lat === undefined || lon === undefined) continue

        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {
            id: `osm-${el.type}-${el.id}`,
            name: tags.name ?? null,
            category,
            tags,
            osmId: el.id,
            osmType: el.type,
            lat,
            lng: lon,
          },
        })
      }

      return features
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new OverpassTimeoutError()
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
      signal.removeEventListener('abort', onOuterAbort)
    }
  }

  // Loop exhausted all retries (unreachable with the guard above, but required by TS)
  throw new Error('Overpass: max retries exceeded')
}

/** Build the composite query key used in IndexedDB (one entry per category per tile) */
function tileQueryKey(category: POICategory): string {
  return `v1:${category}`
}

/**
 * Fetch POIs for a set of tiles, using IndexedDB cache when available.
 * Returns after all tiles have been fetched/loaded.
 */
async function fetchPOIsForTiles(
  tiles: Array<{ x: number; y: number }>,
  categories: POICategory[],
  signal: AbortSignal,
): Promise<Feature<Point>[]> {
  const db = getDB()
  const now = Date.now()
  const queryKeys = categories.map(tileQueryKey)

  // Determine which tiles need fetching
  const tilesToFetch: Array<{ x: number; y: number; missingCategories: POICategory[] }> = []

  if (dbAvailable && db) {
    for (const { x, y } of tiles) {
      try {
        const cached = await db.overpasstiles.where('[x+y]').equals([x, y]).toArray()
        const freshKeys = new Set(
          cached
            .filter((t) => now - t.time < TILE_EXPIRY_MS)
            .map((t) => t.query),
        )
        const missing = categories.filter((c) => !freshKeys.has(tileQueryKey(c)))
        if (missing.length > 0) {
          tilesToFetch.push({ x, y, missingCategories: missing })
        }
      } catch {
        tilesToFetch.push({ x, y, missingCategories: categories })
      }
    }
  } else {
    tiles.forEach(({ x, y }) =>
      tilesToFetch.push({ x, y, missingCategories: categories }),
    )
  }

  // Accumulate features in memory for fallback (no-db) path
  const inMemoryFeatures: Feature<Point>[] = []
  let abortError: OverpassTimeoutError | null = null

  // Tiles that timed out on the first pass are collected here for a single retry.
  const timedOutItems: Array<{ x: number; y: number; missingCategories: POICategory[] }> = []
  // Set to true during the retry pass so timed-out tiles are not collected again.
  let isRetryPass = false

  async function fetchAndStore(
    item: { x: number; y: number; missingCategories: POICategory[] },
  ): Promise<void> {
    if (signal.aborted) return
    try {
      const features = await fetchTile(item.x, item.y, item.missingCategories, signal)

      if (dbAvailable && db) {
        const tileEntries = item.missingCategories.map((c) => ({
          query: tileQueryKey(c),
          x: item.x,
          y: item.y,
          time: Date.now(),
        }))
        const dataEntries = features.map((f) => ({
          query: tileQueryKey(f.properties!.category as POICategory),
          id: f.properties!.osmId as number,
          poi: f,
        }))
        try {
          await db.transaction('rw', db.overpasstiles, db.overpassdata, async () => {
            await db.overpasstiles.bulkPut(tileEntries)
            await db.overpassdata.bulkPut(dataEntries)
          })
        } catch {
          inMemoryFeatures.push(...features)
        }
      } else {
        inMemoryFeatures.push(...features)
      }
    } catch (err) {
      if (err instanceof OverpassTimeoutError) {
        if (signal.aborted) {
          // Outer signal fired (user cancelled) — propagate to stop the whole search.
          abortError = err
        } else if (!isRetryPass) {
          // First-pass timeout — queue for a single retry attempt after other tiles finish.
          console.warn('[overpass] tile timeout, will retry:', item.x, item.y)
          timedOutItems.push(item)
        } else {
          // Retry also timed out — skip permanently.
          console.warn('[overpass] tile timeout on retry, skipping:', item.x, item.y)
        }
      } else {
        console.warn('[overpass] tile fetch error:', err)
      }
    }
  }

  // First pass: process all tiles through the worker pool.
  // JS is single-threaded so queue.shift() is atomic — no spinning, no busy-wait.
  const jobQueue = [...tilesToFetch]
  await Promise.all(
    Array.from({ length: Math.min(jobQueue.length, MAX_CONCURRENT) }, async () => {
      let job = jobQueue.shift()
      while (job) {
        await fetchAndStore(job)
        job = jobQueue.shift()
      }
    }),
  )

  // Retry pass: attempt tiles that timed out during the first pass.
  // By this point the other servers in the round-robin have already handled different
  // tiles, so nextServer() will naturally pick a fresh host for each retry.
  if (timedOutItems.length > 0 && !signal.aborted && !abortError) {
    isRetryPass = true
    console.info(`[overpass] retrying ${timedOutItems.length} timed-out tile(s)`)
    const retryQueue = [...timedOutItems]
    await Promise.all(
      Array.from({ length: Math.min(retryQueue.length, MAX_CONCURRENT) }, async () => {
        let job = retryQueue.shift()
        while (job) {
          await fetchAndStore(job)
          job = retryQueue.shift()
        }
      }),
    )
  }

  // Propagate outer-abort errors after all tile fetches have settled
  if (abortError) throw abortError

  // Read results: from IndexedDB if available, otherwise use in-memory accumulation
  if (dbAvailable && db) {
    try {
      const rows = await db.overpassdata
        .where('query')
        .anyOf(queryKeys)
        .toArray()
      return rows.map((r) => r.poi)
    } catch {
      return inMemoryFeatures
    }
  }
  return inMemoryFeatures
}

/**
 * Main public API — replaces the old fetchPOIsAlongRoute.
 *
 * Fetches POIs within `bufferMetres` of the route polyline using tile-based
 * Overpass queries with IndexedDB caching. After loading tiles, filters results
 * to only include POIs within the actual buffer distance from the route.
 */
export async function fetchPOIsAlongRoute(
  routeGeometry: LineStringGeometry,
  bufferMetres: number,
  categories: POICategory[],
  signal?: AbortSignal,
): Promise<POI[]> {
  if (categories.length === 0) return []

  const coords = routeGeometry.coordinates
  if (coords.length === 0) return []

  // Thin route coords to max 300 points for tile computation and distance filtering.
  // GraphHopper routes can have thousands of points; most are redundant for tile coverage.
  const thinned = thinCoords(coords, 300)

  // Per-segment corridor tile selection: expand each segment's bbox by bufferMetres and
  // collect unique tiles. This fetches only tiles near the actual route, not the full
  // rectangular bbox. For a 50km route this is typically ~20 tiles vs ~100+ for bbox.
  const tileSet = new Set<string>()
  const tileList: Array<{ x: number; y: number }> = []

  for (let i = 0; i < thinned.length - 1; i++) {
    const [lng0, lat0] = thinned[i]
    const [lng1, lat1] = thinned[i + 1]

    const segWest = Math.min(lng0, lng1)
    const segEast = Math.max(lng0, lng1)
    const segSouth = Math.min(lat0, lat1)
    const segNorth = Math.max(lat0, lat1)

    const [ew, es, ee, en] = expandBbox(segWest, segSouth, segEast, segNorth, bufferMetres)
    const range = bboxToTiles(ew, es, ee, en, QUERY_ZOOM)

    for (let x = range.minX; x <= range.maxX; x++) {
      for (let y = range.minY; y <= range.maxY; y++) {
        const key = `${x}:${y}`
        if (!tileSet.has(key)) {
          tileSet.add(key)
          tileList.push({ x, y })
        }
      }
    }
  }

  const abortSignal = signal ?? new AbortController().signal
  const features = await fetchPOIsForTiles(tileList, categories, abortSignal)

  // Filter: only keep POIs within bufferMetres from the actual (thinned) polyline
  const pois: POI[] = []
  for (const f of features) {
    const props = f.properties!
    const lng = f.geometry.coordinates[0]
    const lat = f.geometry.coordinates[1]
    const dist = pointToPolylineDistanceM(lng, lat, thinned)
    if (dist > bufferMetres) continue

    const category = props.category as POICategory
    if (!categories.includes(category)) continue

    pois.push({
      id: props.id as string,
      lat,
      lng,
      name: props.name ?? undefined,
      category,
      tags: props.tags as Record<string, string>,
      osmId: props.osmId as number,
      osmType: props.osmType as 'node' | 'way' | 'relation',
    })
  }

  // Deduplicate by id (tile overlap can produce duplicates)
  const seen = new Set<string>()
  return pois.filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
}
