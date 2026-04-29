import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { prisma } from '../db.js'
import { AuthError, validateTelegramInitData } from '../middleware/auth.js'
import { resolveSessionIdentity } from '../middleware/sessionAuth.js'
import { broadcastRouteUpdate } from '../ws/hub.js'
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
  // GET /api/user-bot-routes — own bot routes
  fastify.get<{ Querystring: { limit?: string; offset?: string } }>('/', async (req, reply) => {
    try {
      const telegramId = await resolveTelegramId(req)
      const limit = Math.min(Number(req.query.limit ?? 20), 50)
      const offset = Number(req.query.offset ?? 0)
      const routes = await prisma.route.findMany({
        where: { creatorTelegramId: telegramId },
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

  // PATCH /api/user-bot-routes/:id — update name and/or waypoints
  fastify.patch<{ Params: { id: string }; Body: { name?: string; waypoints?: unknown[] } }>(
    '/:id',
    async (req, reply) => {
      try {
        const telegramId = await resolveTelegramId(req)
        const route = await prisma.route.findUnique({
          where: { id: req.params.id },
          select: { creatorTelegramId: true, groupId: true, group: { select: { chatId: true } } },
        })
        if (!route) return reply.code(404).send({ error: 'Not found' })
        if (route.creatorTelegramId !== telegramId) return reply.code(403).send({ error: 'Forbidden' })

        const { name, waypoints } = req.body

        if (waypoints !== undefined) {
          const valid = Array.isArray(waypoints) &&
            waypoints.every((w: unknown) => {
              const wp = w as Record<string, unknown>
              return typeof wp.lat === 'number' && typeof wp.lng === 'number' &&
                     wp.lat >= -90 && wp.lat <= 90 && wp.lng >= -180 && wp.lng <= 180
            })
          if (!valid) return reply.code(400).send({ error: 'Invalid waypoints' })
        }

        const data: Prisma.RouteUpdateInput = {}
        if (name !== undefined) data.name = name.trim()
        if (waypoints !== undefined) data.waypoints = waypoints as Prisma.InputJsonValue

        const updated = await prisma.route.update({
          where: { id: req.params.id },
          data,
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

        // Broadcast real-time update if waypoints changed
        if (waypoints !== undefined) {
          broadcastRouteUpdate(
            route.group.chatId.toString(),
            req.params.id,
            waypoints as Array<{ lat: number; lng: number; label?: string; order: number }>,
          )
        }

        return reply.send(toDTO(updated))
      } catch (err) {
        if (err instanceof AuthError) return reply.code(401).send({ error: err.message })
        throw err
      }
    },
  )

  // DELETE /api/user-bot-routes/:id — delete own bot route
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const telegramId = await resolveTelegramId(req)
      const route = await prisma.route.findUnique({
        where: { id: req.params.id },
        select: { creatorTelegramId: true, groupId: true, group: { select: { id: true, activeRouteId: true } } },
      })
      if (!route) return reply.code(404).send({ error: 'Not found' })
      if (route.creatorTelegramId !== telegramId) return reply.code(403).send({ error: 'Forbidden' })

      await prisma.$transaction(async (tx) => {
        // Clear activeRouteId if it points to this route
        if (route.group.activeRouteId === req.params.id) {
          await tx.group.update({
            where: { id: route.group.id },
            data: { activeRouteId: null },
          })
        }
        await tx.route.delete({ where: { id: req.params.id } })
      })

      return reply.code(204).send()
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ error: err.message })
      throw err
    }
  })
}
