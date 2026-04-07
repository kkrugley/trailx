import type { RoutePoint, RouteResult, RoutingProfile } from '@trailx/shared'
import type { AppSettings } from '../store/useMapStore'

// Always use relative URL — Vite proxy in dev, Vercel rewrite in production
const GH_ROUTE_URL = '/api/route'

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

// ── Profile settings → GraphHopper custom_model ─────────────────────────────

export type ProfileSettings = AppSettings['foot'] | AppSettings['bike'] | AppSettings['mtb'] | AppSettings['racingbike']

interface CustomModelRule {
  if: string
  multiply_by: number
}

interface CustomModel {
  priority?: CustomModelRule[]
  distance_influence?: number
}

function buildCustomModel(
  profile: RoutingProfile,
  settings: ProfileSettings,
): CustomModel | null {
  const priority: CustomModelRule[] = []
  let distance_influence: number | undefined

  if (profile === 'foot') {
    const s = settings as AppSettings['foot']
    if (s.preferFootpaths) {
      priority.push({ if: 'road_class == FOOTWAY || road_class == PATH', multiply_by: 3 })
    }
    if (s.avoidRoads) {
      priority.push({ if: 'road_class == PRIMARY || road_class == SECONDARY || road_class == TERTIARY', multiply_by: 0.1 })
    }
  } else if (profile === 'bike') {
    const s = settings as AppSettings['bike']
    if (s.routeType === 'short') distance_influence = 200
    if (s.routeType === 'safest') {
      priority.push({ if: 'bike_network != MISSING', multiply_by: 2 })
    }
    if (s.avoidHighways) {
      priority.push({ if: 'road_class == MOTORWAY', multiply_by: 0 })
    }
  } else if (profile === 'mtb') {
    const s = settings as AppSettings['mtb']
    if (s.difficulty === 'low') {
      priority.push({ if: 'mtb_rating > 2', multiply_by: 0 })
    }
    if (s.avoidPaved) {
      priority.push({ if: 'surface == PAVED || surface == ASPHALT', multiply_by: 0.2 })
    }
  } else if (profile === 'racingbike') {
    const s = settings as AppSettings['racingbike']
    if (s.routeType === 'short') distance_influence = 200
    if (s.avoidCobblestones) {
      priority.push({ if: 'surface == COBBLESTONE', multiply_by: 0 })
    }
  }

  if (priority.length === 0 && distance_influence === undefined) return null

  const model: CustomModel = {}
  if (priority.length > 0) model.priority = priority
  if (distance_influence !== undefined) model.distance_influence = distance_influence
  return model
}

// Once we learn the API doesn't support flexible mode, skip custom_model on future requests
let flexibleModeSupported = true

// ── Public API ───────────────────────────────────────────────────────────────

async function fetchGH(
  body: Record<string, unknown>,
  cancelSignal?: AbortSignal,
): Promise<GHResponse> {
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
    response = await fetch(GH_ROUTE_URL, {
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

  if (response.status === 429) throw new RateLimitError()

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string }
    throw new RoutingError(data.message ?? `GraphHopper error ${response.status}`)
  }

  return (await response.json()) as GHResponse
}

export async function buildRoute(
  waypoints: RoutePoint[],
  profile: RoutingProfile,
  profileSettings: ProfileSettings,
  cancelSignal?: AbortSignal,
): Promise<RouteResult> {
  if (waypoints.length < 2) {
    throw new RoutingError('At least 2 waypoints are required.')
  }

  const customModel = buildCustomModel(profile, profileSettings)

  const baseBody: Record<string, unknown> = {
    profile,
    points: waypoints.map((p) => [p.lng, p.lat]),
    points_encoded: false,
    elevation: true,
    details: ['surface', 'road_class'],
  }

  let data: GHResponse
  if (customModel && flexibleModeSupported) {
    try {
      data = await fetchGH(
        { ...baseBody, custom_model: customModel, 'ch.disable': true },
        cancelSignal,
      )
    } catch (err) {
      // Free GraphHopper tier doesn't support flexible mode — fall back to basic routing
      if (err instanceof RoutingError && err.message.includes('flexible')) {
        flexibleModeSupported = false
        console.warn('[GH] custom_model not supported on this plan, using basic routing')
        data = await fetchGH(baseBody, cancelSignal)
      } else {
        throw err
      }
    }
  } else {
    data = await fetchGH(baseBody, cancelSignal)
  }

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
