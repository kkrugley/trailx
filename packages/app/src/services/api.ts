import type { SessionPayload, CreateSessionResponse, GetSessionResponse } from '@trailx/shared'

const API_BASE = (import.meta as ImportMeta & { env: Record<string, string> }).env
  .VITE_API_URL ?? 'http://localhost:3000'

export interface RemoteWaypoint {
  lat: number
  lng: number
  name?: string
}

export interface RemoteRoute {
  id: string
  name: string
  waypoints: RemoteWaypoint[]
}

export async function getRoute(routeId: string): Promise<RemoteRoute> {
  const res = await fetch(`${API_BASE}/routes/${routeId}`)
  if (!res.ok) throw new Error(`Failed to fetch route "${routeId}": ${res.status}`)
  return res.json() as Promise<RemoteRoute>
}

// ── Session sharing ───────────────────────────────────────────────────────────

export class SessionNotFoundError extends Error {
  constructor() {
    super('Session not found or expired')
    this.name = 'SessionNotFoundError'
  }
}

type AuthHeaders =
  | { 'x-telegram-initdata': string }
  | { 'x-device-id': string }

export async function createSession(
  payload: SessionPayload,
  auth: AuthHeaders,
): Promise<CreateSessionResponse> {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(payload),
  })
  if (res.status !== 201) {
    const data = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? `Failed to create session: ${res.status}`)
  }
  return res.json() as Promise<CreateSessionResponse>
}

export async function getSession(id: string): Promise<GetSessionResponse> {
  const res = await fetch(`${API_BASE}/api/sessions/${id}`)
  if (res.status === 404) throw new SessionNotFoundError()
  if (!res.ok) throw new Error(`Failed to get session: ${res.status}`)
  return res.json() as Promise<GetSessionResponse>
}
