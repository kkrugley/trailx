import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.mock('../db.js', () => ({
  prisma: {
    route: {
      findMany: vi.fn(),
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
import { userBotRoutesRoutes } from './userBotRoutes.js'

const mockRoute = prisma.route as unknown as Record<string, ReturnType<typeof vi.fn>>
const mockValidateInitData = validateTelegramInitData as ReturnType<typeof vi.fn>
const mockResolveSession = resolveSessionIdentity as ReturnType<typeof vi.fn>

const DB_ROUTE = {
  id: 'bot-route-1',
  name: 'Minsk → Nesvizh',
  waypoints: [{ lat: 53.9, lng: 27.5, order: 0 }],
  distanceKm: 105.2,
  elevationM: 320,
  groupId: 'g1',
  createdAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-02'),
}

async function buildApp() {
  const app = Fastify()
  await app.register(userBotRoutesRoutes)
  return app
}

describe('GET /api/user-bot-routes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns bot routes for TMA-authenticated user', async () => {
    mockValidateInitData.mockReturnValue({ telegramUserId: BigInt(1001) })
    mockRoute.findMany.mockResolvedValue([DB_ROUTE])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/',
      headers: { 'x-telegram-initdata': 'valid_init_data' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as unknown[]
    expect(body).toHaveLength(1)
    expect((body[0] as Record<string, unknown>)['id']).toBe('bot-route-1')
    expect((body[0] as Record<string, unknown>)['name']).toBe('Minsk → Nesvizh')
    expect((body[0] as Record<string, unknown>)['groupId']).toBe('g1')
    expect((body[0] as Record<string, unknown>)['distanceKm']).toBe(105.2)
  })

  it('returns bot routes for session-authenticated user', async () => {
    mockResolveSession.mockResolvedValue({ userId: 'u1', telegramId: BigInt(1001) })
    mockRoute.findMany.mockResolvedValue([DB_ROUTE])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/',
    })

    expect(res.statusCode).toBe(200)
    expect((res.json() as unknown[]).length).toBe(1)
  })

  it('returns empty array when user has no bot routes', async () => {
    mockValidateInitData.mockReturnValue({ telegramUserId: BigInt(1001) })
    mockRoute.findMany.mockResolvedValue([])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/',
      headers: { 'x-telegram-initdata': 'valid_init_data' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns 401 when not authenticated', async () => {
    const { AuthError } = await import('../middleware/auth.js')
    mockResolveSession.mockRejectedValue(new AuthError('Not authenticated'))

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/',
    })

    expect(res.statusCode).toBe(401)
  })

  it('serialises null fields correctly', async () => {
    mockValidateInitData.mockReturnValue({ telegramUserId: BigInt(1001) })
    mockRoute.findMany.mockResolvedValue([{
      ...DB_ROUTE,
      name: null,
      distanceKm: null,
      elevationM: null,
    }])

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/',
      headers: { 'x-telegram-initdata': 'valid_init_data' },
    })

    const body = res.json() as Record<string, unknown>[]
    expect(body[0]['name']).toBe('')
    expect(body[0]['distanceKm']).toBeNull()
    expect(body[0]['elevationM']).toBeNull()
  })
})
