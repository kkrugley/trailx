import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sessionRoutes } from './sessions.js'

// ── Mock prisma ──────────────────────────────────────────────────────────────

vi.mock('../db.js', () => ({
  prisma: {
    sharedSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from '../db.js'
const mockSession = prisma.sharedSession as unknown as {
  create: ReturnType<typeof vi.fn>
  findUnique: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_BODY = {
  waypoints: [{ lat: 48.8, lng: 2.3 }],
  routeResult: null,
  standalonePois: [],
  measureSessions: [],
  appSettings: { distanceUnit: 'km' },
}

const DB_SESSION = {
  id: 'cuid-session-1',
  editToken: 'edit-token-abc',
  waypoints: VALID_BODY.waypoints,
  routeResult: null,
  standalonePois: [],
  measureSessions: [],
  appSettings: VALID_BODY.appSettings,
  name: null,
  expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  telegramUserId: null,
  deviceId: 'device-test-12345',
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ── Build test app ────────────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(sessionRoutes, { prefix: '/api/sessions' })
  return app
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/sessions', () => {
  beforeEach(() => {
    mockSession.create.mockResolvedValue(DB_SESSION)
  })

  it('returns 201 with session fields for valid body + device header', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { 'x-device-id': 'device-test-12345', 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.id).toBe(DB_SESSION.id)
    expect(body.editToken).toBe(DB_SESSION.editToken)
    expect(body.shareUrl).toContain(DB_SESSION.id)
    expect(body.expiresAt).toBeDefined()
  })

  it('returns 401 when no identity header is provided', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBeDefined()
  })

  it('returns 400 for invalid body', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { 'x-device-id': 'device-test-12345', 'content-type': 'application/json' },
      body: JSON.stringify({ waypoints: 'not-an-array' }),
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/sessions/:id', () => {
  it('returns 200 with session payload and no editToken', async () => {
    mockSession.findUnique.mockResolvedValue(DB_SESSION)
    const app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${DB_SESSION.id}`,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(DB_SESSION.id)
    expect(body.payload).toBeDefined()
    expect(body.editToken).toBeUndefined()
  })

  it('returns 404 for unknown session', async () => {
    mockSession.findUnique.mockResolvedValue(null)
    const app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions/nonexistent-id',
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for expired session', async () => {
    mockSession.findUnique.mockResolvedValue({
      ...DB_SESSION,
      expiresAt: new Date(Date.now() - 1000),
    })
    const app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${DB_SESSION.id}`,
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('PATCH /api/sessions/:id', () => {
  it('returns 200 with updated session for valid editToken', async () => {
    mockSession.findUnique.mockResolvedValue(DB_SESSION)
    mockSession.update.mockResolvedValue(DB_SESSION)
    const app = await buildApp()

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${DB_SESSION.id}`,
      headers: { 'x-edit-token': DB_SESSION.editToken, 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(DB_SESSION.id)
  })

  it('returns 403 for wrong editToken', async () => {
    mockSession.findUnique.mockResolvedValue(DB_SESSION)
    const app = await buildApp()

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${DB_SESSION.id}`,
      headers: { 'x-edit-token': 'wrong-token', 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    expect(res.statusCode).toBe(403)
  })
})

describe('DELETE /api/sessions/:id', () => {
  it('returns 204 for valid editToken', async () => {
    mockSession.findUnique.mockResolvedValue(DB_SESSION)
    mockSession.delete.mockResolvedValue(DB_SESSION)
    const app = await buildApp()

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/sessions/${DB_SESSION.id}`,
      headers: { 'x-edit-token': DB_SESSION.editToken },
    })

    expect(res.statusCode).toBe(204)
  })

  it('returns 403 for wrong editToken', async () => {
    mockSession.findUnique.mockResolvedValue(DB_SESSION)
    const app = await buildApp()

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/sessions/${DB_SESSION.id}`,
      headers: { 'x-edit-token': 'bad-token' },
    })

    expect(res.statusCode).toBe(403)
  })
})
