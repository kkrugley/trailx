import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../db.js', () => ({
  prisma: {
    savedRoute: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('../middleware/auth.js', async () => {
  class AuthError extends Error {}
  return { AuthError, validateTelegramInitData: vi.fn() }
})

vi.mock('../middleware/sessionAuth.js', () => ({
  resolveSessionIdentity: vi.fn(),
}))

import { prisma } from '../db.js'
import { validateTelegramInitData } from '../middleware/auth.js'
import { resolveSessionIdentity } from '../middleware/sessionAuth.js'
import { savedRoutesRoutes } from './savedRoutes.js'

const mockRoutes = prisma.savedRoute as unknown as Record<string, ReturnType<typeof vi.fn>>
const mockUser = prisma.user as unknown as Record<string, ReturnType<typeof vi.fn>>
const mockValidateInitData = validateTelegramInitData as ReturnType<typeof vi.fn>
const mockResolveSession = resolveSessionIdentity as ReturnType<typeof vi.fn>

const DB_ROUTE = {
  id: 'route-1',
  name: 'My Route',
  waypoints: [{ lat: 53.9, lng: 27.5 }],
  distanceKm: 12.5,
  elevationM: 100,
  profileId: 'bike',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

async function buildApp() {
  const app = Fastify()

  // Stub @fastify/cookie decorators
  app.decorateRequest('cookies', null)
  app.decorateRequest('unsignCookie', null)
  app.addHook('onRequest', (req, _reply, done) => {
    req.cookies = {}
    req.unsignCookie = () => ({ valid: false, renew: false, value: null })
    done()
  })

  await app.register(savedRoutesRoutes, { prefix: '/api/saved-routes' })
  return app
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/saved-routes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns routes for TMA user (initdata header)', async () => {
    mockValidateInitData.mockReturnValue({ telegramUserId: BigInt(1) })
    mockUser.findUnique.mockResolvedValue({ id: 'user-1' })
    mockRoutes.findMany.mockResolvedValue([DB_ROUTE])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/saved-routes',
      headers: { 'x-telegram-initdata': 'user=...&hash=abc' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as unknown[]
    expect(body).toHaveLength(1)
  })

  it('returns routes for web user (session cookie resolved)', async () => {
    mockResolveSession.mockResolvedValue({ userId: 'user-1', telegramId: BigInt(1) })
    mockRoutes.findMany.mockResolvedValue([DB_ROUTE])

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/saved-routes' })
    expect(res.statusCode).toBe(200)
  })

  it('returns 401 when not authenticated', async () => {
    const { AuthError } = await import('../middleware/auth.js')
    mockResolveSession.mockRejectedValue(new AuthError('Not authenticated'))

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/saved-routes' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/saved-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveSession.mockResolvedValue({ userId: 'user-1', telegramId: BigInt(1) })
    mockRoutes.create.mockResolvedValue(DB_ROUTE)
  })

  it('creates route and returns 201', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/saved-routes',
      payload: { name: 'My Route', waypoints: [], profileId: 'bike' },
    })
    expect(res.statusCode).toBe(201)
  })

  it('returns 400 on invalid body', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/saved-routes',
      payload: { name: 'No profile' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /api/saved-routes/:id', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deletes own route and returns 204', async () => {
    mockResolveSession.mockResolvedValue({ userId: 'user-1', telegramId: BigInt(1) })
    mockRoutes.findUnique.mockResolvedValue({ userId: 'user-1' })
    mockRoutes.delete.mockResolvedValue({})

    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/saved-routes/route-1' })
    expect(res.statusCode).toBe(204)
  })

  it('returns 403 when deleting another user route', async () => {
    mockResolveSession.mockResolvedValue({ userId: 'user-1', telegramId: BigInt(1) })
    mockRoutes.findUnique.mockResolvedValue({ userId: 'user-OTHER' })

    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/saved-routes/route-other' })
    expect(res.statusCode).toBe(403)
  })
})
