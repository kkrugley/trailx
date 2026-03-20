import type { RoutePoint, RouteResult, RoutingProfile } from '@trailx/shared'

const DEMO_ENDPOINT = 'https://graphhopper.com/api/1/route'
const TIMEOUT_MS = 15_000

// ── Error types ──────────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  constructor() {
    super('Лимит GraphHopper исчерпан. Введите свой API ключ.')
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

interface GHPath {
  points: GHPoint
  distance: number
  time: number // milliseconds
  details?: {
    elevation?: number[]
  }
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

  const apiKey = import.meta.env.VITE_GRAPHHOPPER_API_KEY as string | undefined

  const params = new URLSearchParams({
    profile,
    points_encoded: 'false',
    elevation: 'true',
    ...(apiKey ? { key: apiKey } : { key: 'LijBPDQGfu7Iiq80w3HzwB4RUDJbMbj6M3ECbZ-iqhg' }),
  })

  // Build point params — GH expects multiple `point` query params
  const pointParams = waypoints
    .map((p) => `point=${p.lat},${p.lng}`)
    .join('&')

  const url = `${DEMO_ENDPOINT}?${params.toString()}&${pointParams}`

  // Combine timeout + external cancellation into one controller
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
    response = await fetch(url, { signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (cancelSignal?.aborted) throw err  // propagate cancellation as-is
      throw new RoutingError('GraphHopper request timed out (15s).')
    }
    throw new RoutingError('Network error while contacting GraphHopper.')
  } finally {
    clearTimeout(timeoutId)
  }

  if (response.status === 429) {
    throw new RateLimitError()
  }

  if (response.status === 401 || response.status === 403) {
    throw new RoutingError(
      'GraphHopper API key недействителен. Установите VITE_GRAPHHOPPER_API_KEY в .env',
    )
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string }
    throw new RoutingError(body.message ?? `GraphHopper error ${response.status}`)
  }

  const data = (await response.json()) as GHResponse

  const path = data.paths[0]
  if (!path) {
    throw new RoutingError('GraphHopper returned no route.')
  }

  const coords = path.points.coordinates
  const elevation = coords.map((c) => c[2] ?? 0)

  return {
    geometry: {
      type: 'LineString',
      coordinates: coords.map((c) => [c[0], c[1]]), // strip elevation from geometry coords
    },
    distance: path.distance,
    duration: Math.round(path.time / 1000), // ms → s
    elevation,
  }
}
