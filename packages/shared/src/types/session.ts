/** Payload sent by the client when creating or updating a session */
export interface SessionPayload {
  waypoints: unknown[]
  routeResult: unknown | null
  standalonePois: unknown[]
  measureSessions: unknown[]
  appSettings: unknown
  name?: string
}

/** Server response on session creation */
export interface CreateSessionResponse {
  id: string
  editToken: string
  shareUrl: string  // https://<APP_URL>/s/<id>
  expiresAt: string // ISO 8601
}

/** Server response on session read (public — no editToken) */
export interface GetSessionResponse {
  id: string
  payload: SessionPayload
  name: string | null
  expiresAt: string
}
