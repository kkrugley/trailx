import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { prisma } from '../db.js'
import { AuthError, validateTelegramInitData } from '../middleware/auth.js'
import { resolveSessionIdentity } from '../middleware/sessionAuth.js'
import type { SavedRouteDTO, SaveRoutePayload } from '@trailx/shared'
import type { Prisma } from '@prisma/client'

async function resolveUser(req: FastifyRequest): Promise<string> {
  const initData = req.headers['x-telegram-initdata']
  if (typeof initData === 'string' && initData) {
    const identity = validateTelegramInitData(initData)
    const user = await prisma.user.findUnique({
      where: { telegramId: identity.telegramUserId! },
      select: { id: true },
    })
    if (!user) throw new AuthError('User not found — authenticate via /api/auth/tma first')
    return user.id
  }
  const { userId } = await resolveSessionIdentity(req)
  return userId
}

function toDTO(route: {
  id: string
  name: string
  waypoints: Prisma.JsonValue
  distanceKm: number | null
  elevationM: number | null
  profileId: string
  createdAt: Date
  updatedAt: Date
}): SavedRouteDTO {
  return {
    id: route.id,
    name: route.name,
    waypoints: route.waypoints as unknown[],
    distanceKm: route.distanceKm,
    elevationM: route.elevationM,
    profileId: route.profileId,
    createdAt: route.createdAt.toISOString(),
    updatedAt: route.updatedAt.toISOString(),
  }
}

function isValidBody(b: unknown): b is SaveRoutePayload {
  if (!b || typeof b !== 'object') return false
  const obj = b as Record<string, unknown>
  return typeof obj['name'] === 'string' && Array.isArray(obj['waypoints']) && typeof obj['profileId'] === 'string'
}

export const savedRoutesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/saved-routes — list user's routes
  fastify.get('/', async (req, reply) => {
    try {
      const userId = await resolveUser(req)
      const routes = await prisma.savedRoute.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, waypoints: true, distanceKm: true, elevationM: true, profileId: true, createdAt: true, updatedAt: true },
      })
      return reply.send(routes.map(toDTO))
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ error: err.message })
      throw err
    }
  })

  // POST /api/saved-routes — create route
  fastify.post<{ Body: unknown }>('/', async (req, reply) => {
    try {
      const userId = await resolveUser(req)
      if (!isValidBody(req.body)) return reply.code(400).send({ error: 'Invalid body' })

      const { name, waypoints, distanceKm, elevationM, profileId } = req.body
      const route = await prisma.savedRoute.create({
        data: {
          userId,
          name,
          waypoints: waypoints as Prisma.InputJsonValue,
          distanceKm: distanceKm ?? null,
          elevationM: elevationM ?? null,
          profileId,
        },
        select: { id: true, name: true, waypoints: true, distanceKm: true, elevationM: true, profileId: true, createdAt: true, updatedAt: true },
      })
      return reply.code(201).send(toDTO(route))
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ error: err.message })
      throw err
    }
  })

  // PATCH /api/saved-routes/:id — rename route
  fastify.patch<{ Params: { id: string }; Body: { name: string } }>('/:id', async (req, reply) => {
    try {
      const userId = await resolveUser(req)
      const existing = await prisma.savedRoute.findUnique({ where: { id: req.params.id }, select: { userId: true } })
      if (!existing) return reply.code(404).send({ error: 'Not found' })
      if (existing.userId !== userId) return reply.code(403).send({ error: 'Forbidden' })

      const { name } = req.body
      if (typeof name !== 'string' || !name.trim()) return reply.code(400).send({ error: 'Invalid name' })

      const route = await prisma.savedRoute.update({
        where: { id: req.params.id },
        data: { name: name.trim() },
        select: { id: true, name: true, waypoints: true, distanceKm: true, elevationM: true, profileId: true, createdAt: true, updatedAt: true },
      })
      return reply.send(toDTO(route))
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ error: err.message })
      throw err
    }
  })

  // DELETE /api/saved-routes/:id — delete route
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const userId = await resolveUser(req)
      const existing = await prisma.savedRoute.findUnique({ where: { id: req.params.id }, select: { userId: true } })
      if (!existing) return reply.code(404).send({ error: 'Not found' })
      if (existing.userId !== userId) return reply.code(403).send({ error: 'Forbidden' })

      await prisma.savedRoute.delete({ where: { id: req.params.id } })
      return reply.code(204).send()
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ error: err.message })
      throw err
    }
  })
}
