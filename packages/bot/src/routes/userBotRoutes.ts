import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { prisma } from '../db.js'
import { AuthError, validateTelegramInitData } from '../middleware/auth.js'
import { resolveSessionIdentity } from '../middleware/sessionAuth.js'
import type { BotRouteDTO } from '@trailx/shared'
import type { Prisma } from '@prisma/client'

async function resolveTelegramId(req: FastifyRequest): Promise<bigint> {
  const initData = req.headers['x-telegram-initdata']
  if (typeof initData === 'string' && initData) {
    const identity = validateTelegramInitData(initData)
    return identity.telegramUserId!
  }
  const { telegramId } = await resolveSessionIdentity(req)
  return telegramId
}

function toDTO(route: {
  id: string
  name: string | null
  waypoints: Prisma.JsonValue
  distanceKm: number | null
  elevationM: number | null
  groupId: string
  createdAt: Date
  updatedAt: Date
}): BotRouteDTO {
  return {
    id: route.id,
    name: route.name ?? '',
    waypoints: route.waypoints as unknown[],
    distanceKm: route.distanceKm,
    elevationM: route.elevationM,
    groupId: route.groupId,
    createdAt: route.createdAt.toISOString(),
    updatedAt: route.updatedAt.toISOString(),
  }
}

export const userBotRoutesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (req, reply) => {
    try {
      const telegramId = await resolveTelegramId(req)
      const routes = await prisma.route.findMany({
        where: { creatorTelegramId: telegramId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          name: true,
          waypoints: true,
          distanceKm: true,
          elevationM: true,
          groupId: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      return reply.send(routes.map(toDTO))
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ error: err.message })
      throw err
    }
  })
}
