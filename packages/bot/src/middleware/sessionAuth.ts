import type { FastifyRequest } from 'fastify'
import { prisma } from '../db.js'
import { AuthError } from './auth.js'

export interface SessionIdentity {
  userId: string
  telegramId: bigint
}

export async function resolveSessionIdentity(req: FastifyRequest): Promise<SessionIdentity> {
  const raw = req.cookies['__txsid']
  const result = raw ? req.unsignCookie(raw) : null
  const token = result?.valid ? result.value : null
  if (!token) throw new AuthError('Not authenticated')

  const session = await prisma.webSession.findUnique({
    where: { token },
    select: {
      userId: true,
      expiresAt: true,
      user: { select: { telegramId: true } },
    },
  })

  if (!session || session.expiresAt < new Date()) {
    throw new AuthError('Session expired or invalid')
  }

  return { userId: session.userId, telegramId: session.user.telegramId }
}
