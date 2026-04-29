import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { prisma } from '../db.js'
import { AuthError, validateTelegramInitData } from '../middleware/auth.js'
import { resolveSessionIdentity } from '../middleware/sessionAuth.js'
import type { GroupRouteDTO } from '@trailx/shared'
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

function toDTO(
  route: {
    id: string
    name: string | null
    waypoints: Prisma.JsonValue
    distanceKm: number | null
    elevationM: number | null
    groupId: string
    creatorTelegramId: bigint | null
    createdAt: Date
    updatedAt: Date
    group: { chatId: bigint }
  },
  telegramId: bigint,
): GroupRouteDTO {
  return {
    id: route.id,
    name: route.name ?? '',
    waypoints: route.waypoints as unknown[],
    distanceKm: route.distanceKm,
    elevationM: route.elevationM,
    groupId: route.groupId,
    groupChatId: route.group.chatId.toString(),
    isOwner: route.creatorTelegramId === telegramId,
    createdAt: route.createdAt.toISOString(),
    updatedAt: route.updatedAt.toISOString(),
  }
}

export const groupRoutesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/group-routes — all routes from groups the user belongs to
  fastify.get<{ Querystring: { limit?: string; offset?: string } }>('/', async (req, reply) => {
    try {
      const telegramId = await resolveTelegramId(req)
      const limit = Math.min(Number(req.query.limit ?? 20), 50)
      const offset = Number(req.query.offset ?? 0)

      // Find all groups this user is a member of
      const memberships = await prisma.groupMember.findMany({
        where: { telegramId, status: { notIn: ['left', 'kicked'] } },
        select: { groupId: true },
      })

      if (memberships.length === 0) {
        return reply.send([])
      }

      const groupIds = memberships.map((m) => m.groupId)

      const routes = await prisma.route.findMany({
        where: { groupId: { in: groupIds } },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          waypoints: true,
          distanceKm: true,
          elevationM: true,
          groupId: true,
          creatorTelegramId: true,
          createdAt: true,
          updatedAt: true,
          group: { select: { chatId: true } },
        },
      })

      return reply.send(routes.map((r) => toDTO(r, telegramId)))
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ error: err.message })
      throw err
    }
  })
}
