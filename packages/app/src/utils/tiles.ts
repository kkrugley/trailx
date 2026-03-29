/** Slippy Map tile coordinate math (Web Mercator / EPSG:3857) */

export const QUERY_ZOOM = 12

/** Convert longitude to tile X at the given zoom level */
function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
}

/** Convert latitude to tile Y at the given zoom level */
function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom),
  )
}

/** Convert tile X to west longitude */
function tileXToLng(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180
}

/** Convert tile Y to north latitude */
function tileYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export interface TileRange {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** Get the range of tiles at `zoom` that cover the given bbox [west, south, east, north] */
export function bboxToTiles(
  west: number,
  south: number,
  east: number,
  north: number,
  zoom = QUERY_ZOOM,
): TileRange {
  return {
    minX: lngToTileX(west, zoom),
    maxX: lngToTileX(east, zoom),
    minY: latToTileY(north, zoom), // note: Y is inverted (north = smaller Y)
    maxY: latToTileY(south, zoom),
  }
}

/** Get the [west, south, east, north] bbox of a tile */
export function tileToBbox(
  x: number,
  y: number,
  zoom = QUERY_ZOOM,
): [number, number, number, number] {
  const west = tileXToLng(x, zoom)
  const north = tileYToLat(y, zoom)
  const east = tileXToLng(x + 1, zoom)
  const south = tileYToLat(y + 1, zoom)
  return [west, south, east, north]
}

/**
 * Expand a [west, south, east, north] bbox by `metres` in all directions.
 * Uses a rough approximation valid for mid-latitudes:
 *   1° lat ≈ 111 320 m
 *   1° lng ≈ 111 320 * cos(lat) m
 */
export function expandBbox(
  west: number,
  south: number,
  east: number,
  north: number,
  metres: number,
): [number, number, number, number] {
  const latDelta = metres / 111_320
  const midLat = (south + north) / 2
  const lngDelta = metres / (111_320 * Math.cos((midLat * Math.PI) / 180))
  return [west - lngDelta, south - latDelta, east + lngDelta, north + latDelta]
}

/**
 * Compute the squared distance (in degrees²) from point (px, py)
 * to the line segment (ax, ay)–(bx, by).
 * Used for filtering POIs by proximity to route polyline.
 */
export function sqDistToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    const ex = px - ax
    const ey = py - ay
    return ex * ex + ey * ey
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  const projX = ax + t * dx
  const projY = ay + t * dy
  const fx = px - projX
  const fy = py - projY
  return fx * fx + fy * fy
}

/**
 * Approximate distance in metres from a point (lng, lat)
 * to the nearest segment of a polyline.
 */
export function pointToPolylineDistanceM(
  lng: number,
  lat: number,
  coords: number[][],
): number {
  let minSqDeg = Infinity
  for (let i = 0; i < coords.length - 1; i++) {
    const sq = sqDistToSegment(
      lng, lat,
      coords[i][0], coords[i][1],
      coords[i + 1][0], coords[i + 1][1],
    )
    if (sq < minSqDeg) minSqDeg = sq
  }
  // Convert degrees to metres: 1° ≈ 111 320 m
  return Math.sqrt(minSqDeg) * 111_320
}
