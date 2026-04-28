import { createHash, randomBytes } from 'crypto'
import type { FastifyPluginAsync } from 'fastify'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { prisma } from '../db.js'
import { AuthError, validateTelegramInitData } from '../middleware/auth.js'
import { resolveSessionIdentity } from '../middleware/sessionAuth.js'
import type { AuthUser } from '@trailx/shared'

const JWKS = createRemoteJWKSet(new URL('https://oauth.telegram.org/.well-known/jwks.json'))

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  signed: true,
  sameSite: 'none' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
}

const STATE_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  signed: true,
  sameSite: 'none' as const,
  path: '/',
  maxAge: 600,
}

function toAuthUser(user: {
  id: string
  telegramId: bigint
  name: string | null
  username: string | null
  avatarUrl: string | null
}): AuthUser {
  return {
    id: user.id,
    telegramId: Number(user.telegramId),
    name: user.name ?? '',
    username: user.username ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
  }
}

function generateCodeVerifier(): string {
  return randomBytes(48).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// ── OIDC browser-redirect routes (prefix: /auth) ──────────────────────────────

export const authOidcRoutes: FastifyPluginAsync = async (fastify) => {
  const CLIENT_ID = process.env.TELEGRAM_CLIENT_ID ?? ''
  const CLIENT_SECRET = process.env.TELEGRAM_CLIENT_SECRET ?? ''
  const REDIRECT_URI = process.env.TELEGRAM_OIDC_REDIRECT_URI ?? ''
  const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

  // GET /auth/telegram — initiate OIDC Authorization Code flow with PKCE
  fastify.get('/telegram', async (req, reply) => {
    const state = randomBytes(16).toString('hex')
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const returnTo = (req.headers.origin as string | undefined) ?? FRONTEND_URL

    reply.setCookie('tg_oauth_state', state, STATE_COOKIE_OPTS)
    reply.setCookie('tg_pkce', codeVerifier, STATE_COOKIE_OPTS)
    reply.setCookie('tg_return_to', returnTo, STATE_COOKIE_OPTS)

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile telegram:bot_access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    return reply.redirect(`https://oauth.telegram.org/auth?${params.toString()}`)
  })

  // GET /auth/telegram/callback — exchange code for tokens, create session
  fastify.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/telegram/callback',
    async (req, reply) => {
      const { code, state, error } = req.query

      const returnToRaw = req.cookies.tg_return_to
      const returnToResult = returnToRaw ? req.unsignCookie(returnToRaw) : null
      const returnTo = returnToResult?.valid ? returnToResult.value : FRONTEND_URL

      const clearState = () => {
        reply.clearCookie('tg_oauth_state', { path: '/' })
        reply.clearCookie('tg_pkce', { path: '/' })
        reply.clearCookie('tg_return_to', { path: '/' })
      }

      if (error) {
        clearState()
        return reply.redirect(`${returnTo}/?auth=error`)
      }

      // Validate CSRF state
      const storedStateRaw = req.cookies.tg_oauth_state
      const storedStateResult = storedStateRaw ? req.unsignCookie(storedStateRaw) : null
      if (!storedStateResult?.valid || storedStateResult.value !== state || !code) {
        clearState()
        return reply.redirect(`${returnTo}/?auth=error`)
      }

      // Get PKCE verifier
      const pkceRaw = req.cookies.tg_pkce
      const pkceResult = pkceRaw ? req.unsignCookie(pkceRaw) : null
      if (!pkceResult?.valid) {
        clearState()
        return reply.redirect(`${returnTo}/?auth=error`)
      }

      // Exchange code for tokens
      let idToken: string
      try {
        const tokenRes = await fetch('https://oauth.telegram.org/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            code_verifier: pkceResult.value,
          }).toString(),
        })
        if (!tokenRes.ok) {
          console.error('[auth/callback] token exchange failed:', tokenRes.status, await tokenRes.text())
          clearState()
          return reply.redirect(`${returnTo}/?auth=error`)
        }
        const tokens = await tokenRes.json() as { id_token?: string }
        if (!tokens.id_token) {
          clearState()
          return reply.redirect(`${returnTo}/?auth=error`)
        }
        idToken = tokens.id_token
      } catch (err) {
        console.error('[auth/callback] token exchange exception:', err)
        clearState()
        return reply.redirect(`${returnTo}/?auth=error`)
      }

      // Verify id_token JWT
      let payload: Record<string, unknown>
      try {
        const result = await jwtVerify(idToken, JWKS, {
          issuer: 'https://oauth.telegram.org',
          audience: CLIENT_ID,
        })
        payload = result.payload as Record<string, unknown>
      } catch (err) {
        console.error('[auth/callback] JWT verification failed:', err)
        clearState()
        return reply.redirect(`${returnTo}/?auth=error`)
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

      clearState()
      reply.setCookie('__txsid', session.token, SESSION_COOKIE_OPTS)
      return reply.redirect(`${returnTo}/?auth=success`)
    },
  )
}

// ── API auth routes (prefix: /api/auth) ───────────────────────────────────────

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/tma — upsert user from Telegram initData (TMA, no cookie)
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
