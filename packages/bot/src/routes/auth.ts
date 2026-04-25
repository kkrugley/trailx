import type { FastifyPluginAsync } from 'fastify'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { prisma } from '../db.js'
import { AuthError, validateTelegramInitData } from '../middleware/auth.js'
import { resolveSessionIdentity } from '../middleware/sessionAuth.js'
import type { AuthUser } from '@trailx/shared'

const JWKS = createRemoteJWKSet(new URL('https://oauth.telegram.org/.well-known/jwks.json'))

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  signed: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
}

function toAuthUser(user: { id: string; telegramId: bigint; name: string | null; username: string | null; avatarUrl: string | null }): AuthUser {
  return {
    id: user.id,
    telegramId: Number(user.telegramId),
    name: user.name ?? '',
    username: user.username ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
  }
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/telegram — verify id_token from Telegram Login JS SDK
  fastify.post<{ Body: { id_token: string } }>('/telegram', async (req, reply) => {
    const { id_token } = req.body
    if (!id_token || typeof id_token !== 'string') {
      return reply.code(400).send({ error: 'Missing id_token' })
    }

    let payload: Record<string, unknown>
    try {
      const result = await jwtVerify(id_token, JWKS, {
        issuer: 'https://oauth.telegram.org',
        audience: String(process.env.TELEGRAM_CLIENT_ID ?? '8613521247'),
      })
      payload = result.payload as Record<string, unknown>
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired id_token' })
    }

    const telegramId = BigInt(payload['id'] as number)
    const name = String(payload['name'] ?? '')
    const username = (payload['preferred_username'] as string) ?? null
    const avatarUrl = (payload['picture'] as string) ?? null

    const user = await prisma.user.upsert({
      where: { telegramId },
      update: { name, username, avatarUrl },
      create: { telegramId, name, username, avatarUrl },
    })

    const session = await prisma.webSession.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    })

    reply.setCookie('__txsid', session.token, COOKIE_OPTS)
    return reply.send(toAuthUser(user))
  })

  // POST /api/auth/tma — upsert user from Telegram initData, no cookie
  fastify.post('/tma', async (req, reply) => {
    const initData = req.headers['x-telegram-initdata']
    if (typeof initData !== 'string' || !initData) {
      return reply.code(401).send({ error: 'Missing x-telegram-initdata header' })
    }

    let identity: ReturnType<typeof validateTelegramInitData>
    try {
      identity = validateTelegramInitData(initData)
    } catch {
      return reply.code(401).send({ error: 'Invalid initData' })
    }

    const telegramId = identity.telegramUserId!
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {},
      create: { telegramId, name: '' },
    })

    return reply.send(toAuthUser(user))
  })

  // GET /api/auth/me — resolve session cookie → AuthUser or 401
  fastify.get('/me', async (req, reply) => {
    try {
      const { userId } = await resolveSessionIdentity(req)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, telegramId: true, name: true, username: true, avatarUrl: true },
      })
      if (!user) return reply.code(401).send({ error: 'User not found' })
      return reply.send(toAuthUser(user))
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ error: err.message })
      throw err
    }
  })

  // POST /api/auth/logout — delete WebSession, clear cookie
  fastify.post('/logout', async (req, reply) => {
    const raw = req.cookies['__txsid']
    const result = raw ? req.unsignCookie(raw) : null
    const token = result?.valid ? result.value : null

    if (token) {
      await prisma.webSession.deleteMany({ where: { token } })
    }

    reply.clearCookie('__txsid', { path: '/' })
    return reply.send({ ok: true })
  })
}
