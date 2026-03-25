import type { RoutePoint, RouteResult, RoutingProfile } from '@trailx/shared'

const API_BASE = (import.meta as ImportMeta & { env: Record<string, string> }).env
  .VITE_API_URL ?? 'http://localhost:3001'

const TIMEOUT_MS = 15_000

// ── Error types ──────────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  constructor() {
    super('Лимит GraphHopper исчерпан.')
    this.name = 'RateLimitError'
  }
}

export class RoutingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RoutingError'
  }
}

// ── GraphHopper response shape (only the fields we use) ─────────────────────

interface GHPoint {
  type: 'LineString'
  coordinates: number[][] // [lng, lat, ele?]
}

type GHDetail = [number, number, string]

interface GHPath {
  points: GHPoint
  distance: number
  time: number // milliseconds
  details?: {
    surface?: GHDetail[]
    road_class?: GHDetail[]
  }
}

function expandDetail(segments: GHDetail[], length: number): string[] {
  const result = new Array<string>(length).fill('unknown')
  for (const [from, to, value] of segments) {
    for (let i = from; i < to && i < length; i++) result[i] = value
  }
  return result
}

interface GHResponse {
  paths: GHPath[]
  message?: string
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function buildRoute(
  waypoints: RoutePoint[],
  profile: RoutingProfile,
  cancelSignal?: AbortSignal,
): Promise<RouteResult> {
  if (waypoints.length < 2) {
    throw new RoutingError('At least 2 waypoints are required.')
  }

  const body = {
    profile,
    points: waypoints.map((p) => [p.lng, p.lat]),
    points_encoded: false,
    elevation: true,
    details: ['surface', 'road_class'],
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  if (cancelSignal) {
    if (cancelSignal.aborted) {
      clearTimeout(timeoutId)
      throw new DOMException('Cancelled', 'AbortError')
    }
    cancelSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (cancelSignal?.aborted) throw err
      throw new RoutingError('GraphHopper request timed out (15s).')
    }
    throw new RoutingError('Network error while contacting GraphHopper.')
  } finally {
    clearTimeout(timeoutId)
  }

  if (response.status === 429) {
    throw new RateLimitError()
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string }
    throw new RoutingError(data.message ?? `GraphHopper error ${response.status}`)
  }

  const data = (await response.json()) as GHResponse

  const path = data.paths[0]
  if (!path) {
    throw new RoutingError('GraphHopper returned no route.')
  }
  console.debug('[GH] path.details:', path.details)

  const coords = path.points.coordinates
  const elevation = coords.map((c) => c[2] ?? 0)

  const n = coords.length

  return {
    geometry: {
      type: 'LineString',
      coordinates: coords.map((c) => [c[0], c[1]]),
    },
    distance: path.distance,
    duration: Math.round(path.time / 1000),
    elevation,
    surface: path.details?.surface ? expandDetail(path.details.surface, n) : undefined,
    roadClass: path.details?.road_class ? expandDetail(path.details.road_class, n) : undefined,
  }
}
