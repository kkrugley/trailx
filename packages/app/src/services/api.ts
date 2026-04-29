import type { SessionPayload, CreateSessionResponse, GetSessionResponse, AuthUser, SavedRouteDTO, SaveRoutePayload, BotRouteDTO, GroupRouteDTO } from '@trailx/shared'

const API_BASE = (import.meta as ImportMeta & { env: Record<string, string> }).env
  .VITE_API_URL ?? ''

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

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function getMe(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`getMe failed: ${res.status}`)
  return res.json() as Promise<AuthUser>
}

export async function loginWithTMA(initData: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/tma`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-telegram-initdata': initData },
  })
  if (!res.ok) throw new Error(`TMA login failed: ${res.status}`)
  return res.json() as Promise<AuthUser>
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

// ── Saved Routes ──────────────────────────────────────────────────────────────

type TmaHeader = { 'x-telegram-initdata': string } | Record<string, never>

export async function listSavedRoutes(authHeader: TmaHeader = {}): Promise<SavedRouteDTO[]> {
  const res = await fetch(`${API_BASE}/api/saved-routes`, {
    credentials: 'include',
    headers: authHeader,
  })
  if (!res.ok) throw new Error(`listSavedRoutes failed: ${res.status}`)
  return res.json() as Promise<SavedRouteDTO[]>
}

export async function createSavedRoute(payload: SaveRoutePayload, authHeader: TmaHeader = {}): Promise<SavedRouteDTO> {
  const res = await fetch(`${API_BASE}/api/saved-routes`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`createSavedRoute failed: ${res.status}`)
  return res.json() as Promise<SavedRouteDTO>
}

export async function deleteSavedRoute(id: string, authHeader: TmaHeader = {}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/saved-routes/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: authHeader,
  })
  if (!res.ok) throw new Error(`deleteSavedRoute failed: ${res.status}`)
}

export async function listUserBotRoutes(authHeader: TmaHeader = {}): Promise<BotRouteDTO[]> {
  const res = await fetch(`${API_BASE}/api/user-bot-routes`, {
    credentials: 'include',
    headers: authHeader,
  })
  if (!res.ok) throw new Error(`listUserBotRoutes failed: ${res.status}`)
  return res.json() as Promise<BotRouteDTO[]>
}

export async function renameSavedRoute(id: string, name: string, authHeader: TmaHeader = {}): Promise<SavedRouteDTO> {
  const res = await fetch(`${API_BASE}/api/saved-routes/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`renameSavedRoute failed: ${res.status}`)
  return res.json() as Promise<SavedRouteDTO>
}

export async function listGroupRoutes(authHeader: TmaHeader = {}): Promise<GroupRouteDTO[]> {
  const res = await fetch(`${API_BASE}/api/group-routes`, {
    credentials: 'include',
    headers: authHeader,
  })
  if (!res.ok) throw new Error(`listGroupRoutes failed: ${res.status}`)
  return res.json() as Promise<GroupRouteDTO[]>
}

export async function updateBotRoute(
  id: string,
  body: { name?: string; waypoints?: unknown[] },
  authHeader: TmaHeader = {},
): Promise<BotRouteDTO> {
  const res = await fetch(`${API_BASE}/api/user-bot-routes/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`updateBotRoute failed: ${res.status}`)
  return res.json() as Promise<BotRouteDTO>
}

export async function deleteBotRoute(id: string, authHeader: TmaHeader = {}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/user-bot-routes/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: authHeader,
  })
  if (!res.ok) throw new Error(`deleteBotRoute failed: ${res.status}`)
}
