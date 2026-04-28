import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../db.js', () => ({
  prisma: {
    user: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    webSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => Symbol('jwks')),
  jwtVerify: vi.fn(),
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
import { authRoutes } from './auth.js'

const mockUser = prisma.user as unknown as Record<string, ReturnType<typeof vi.fn>>
const mockSession = prisma.webSession as unknown as Record<string, ReturnType<typeof vi.fn>>
const mockValidateInitData = validateTelegramInitData as ReturnType<typeof vi.fn>
const mockResolveSession = resolveSessionIdentity as ReturnType<typeof vi.fn>

const DB_USER = {
  id: 'user-cuid-1',
  telegramId: BigInt(123456789),
  name: 'Test User',
  username: 'testuser',
  avatarUrl: 'https://t.me/avatars/1.jpg',
}

async function buildApp(cookieStore: Record<string, string> = {}) {
  const app = Fastify()

  // Stub @fastify/cookie decorators so routes work without the real plugin
  app.decorateRequest('cookies', null)
  app.decorateRequest('unsignCookie', null)
  app.decorateReply('setCookie', null)
  app.decorateReply('clearCookie', null)

  app.addHook('onRequest', (req, _reply, done) => {
    req.cookies = cookieStore
    req.unsignCookie = (raw: string) => ({ valid: true, renew: false, value: raw.replace('s:', '') })
    done()
  })
  app.addHook('onSend', (_req, reply, payload, done) => {
    const orig = reply.raw
    if (!orig.headersSent) {
      reply.setCookie = (name: string, value: string) => {
        reply.header('set-cookie', `${name}=${value}`)
        return reply
      }
      reply.clearCookie = (name: string) => {
        reply.header('set-cookie', `${name}=; Max-Age=0`)
        return reply
      }
    }
    done(null, payload)
  })
  app.addHook('preParsing', (_req, reply, _payload, done) => {
    reply.setCookie = (name: string, value: string) => {
      reply.header('set-cookie', `${name}=${value}`)
      return reply
    }
    reply.clearCookie = (name: string) => {
      reply.header('set-cookie', `${name}=; Max-Age=0`)
      return reply
    }
    done()
  })

  await app.register(authRoutes, { prefix: '/api/auth' })
  return app
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/auth/tma', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateInitData.mockReturnValue({ telegramUserId: BigInt(123456789) })
    mockUser.upsert.mockResolvedValue(DB_USER)
  })

  it('returns AuthUser on valid initData header', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/tma',
      headers: { 'x-telegram-initdata': 'user=...&hash=abc' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(body).toMatchObject({ id: 'user-cuid-1', telegramId: 123456789 })
  })

  it('returns 401 when header is missing', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/auth/tma' })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns AuthUser when session is valid', async () => {
    mockResolveSession.mockResolvedValue({ userId: 'user-cuid-1', telegramId: BigInt(123456789) })
    mockUser.findUnique.mockResolvedValue(DB_USER)
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    expect(body).toMatchObject({ id: 'user-cuid-1' })
  })

  it('returns 401 when not authenticated', async () => {
    const { AuthError } = await import('../middleware/auth.js')
    mockResolveSession.mockRejectedValue(new AuthError('Not authenticated'))
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.deleteMany.mockResolvedValue({ count: 1 })
  })

  it('returns 200 and responds ok', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
  })
})
