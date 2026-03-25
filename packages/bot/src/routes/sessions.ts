import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import { resolveIdentity, AuthError } from '../middleware/auth.js'
import type { SessionPayload, CreateSessionResponse, GetSessionResponse } from '@trailx/shared'

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000

function isValidBody(body: unknown): body is SessionPayload {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    Array.isArray(b.waypoints) &&
    Array.isArray(b.standalonePois) &&
    Array.isArray(b.measureSessions) &&
    b.appSettings !== null &&
    b.appSettings !== undefined &&
    typeof b.appSettings === 'object'
  )
}

/** Cast unknown[] → Prisma InputJsonValue (array of serialisable values) */
function toJson(v: unknown[]): Prisma.InputJsonValue {
  return v as unknown as Prisma.InputJsonValue
}

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST / — create session
  fastify.post('/', async (req, reply) => {
    let identity
    try {
      identity = resolveIdentity(req)
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({ error: err.message })
      }
      throw err
    }

    if (!isValidBody(req.body)) {
      return reply.code(400).send({ error: 'Invalid body' })
    }

    const body = req.body
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
    const APP_URL = process.env.VITE_APP_URL ?? 'https://trailx.app'

    const session = await prisma.sharedSession.create({
      data: {
        telegramUserId: identity.telegramUserId ?? null,
        deviceId: identity.deviceId ?? null,
        waypoints: toJson(body.waypoints),
        routeResult: body.routeResult != null
          ? (body.routeResult as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        standalonePois: toJson(body.standalonePois),
        measureSessions: toJson(body.measureSessions),
        appSettings: body.appSettings as Prisma.InputJsonValue,
        name: body.name ?? null,
        expiresAt,
      },
    })

    const response: CreateSessionResponse = {
      id: session.id,
      editToken: session.editToken,
      shareUrl: `${APP_URL}/s/${session.id}`,
      expiresAt: session.expiresAt.toISOString(),
    }
    return reply.code(201).send(response)
  })

  // GET /:id — read session (public, no auth)
  fastify.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const session = await prisma.sharedSession.findUnique({
      where: { id: req.params.id },
    })
    if (!session || session.expiresAt < new Date()) {
      return reply.code(404).send({ error: 'Not found' })
    }

    const payload: SessionPayload = {
      waypoints: session.waypoints as unknown[],
      routeResult: session.routeResult as unknown,
      standalonePois: session.standalonePois as unknown[],
      measureSessions: session.measureSessions as unknown[],
      appSettings: session.appSettings,
      name: session.name ?? undefined,
    }

    const response: GetSessionResponse = {
      id: session.id,
      payload,
      name: session.name,
      expiresAt: session.expiresAt.toISOString(),
    }
    return reply.code(200).send(response)
  })

  // PATCH /:id — update session (requires edit token)
  fastify.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const editToken = req.headers['x-edit-token']
    if (typeof editToken !== 'string' || !editToken) {
      return reply.code(403).send({ error: 'Missing edit token' })
    }

    const session = await prisma.sharedSession.findUnique({
      where: { id: req.params.id },
    })
    if (!session || session.expiresAt < new Date()) {
      return reply.code(404).send({ error: 'Not found' })
    }
    if (session.editToken !== editToken) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (!isValidBody(req.body)) {
      return reply.code(400).send({ error: 'Invalid body' })
    }

    const body = req.body
    const updated = await prisma.sharedSession.update({
      where: { id: req.params.id },
      data: {
        waypoints: toJson(body.waypoints),
        routeResult: body.routeResult != null
          ? (body.routeResult as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        standalonePois: toJson(body.standalonePois),
        measureSessions: toJson(body.measureSessions),
        appSettings: body.appSettings as Prisma.InputJsonValue,
        name: body.name ?? null,
      },
    })

    const payload: SessionPayload = {
      waypoints: updated.waypoints as unknown[],
      routeResult: updated.routeResult as unknown,
      standalonePois: updated.standalonePois as unknown[],
      measureSessions: updated.measureSessions as unknown[],
      appSettings: updated.appSettings,
      name: updated.name ?? undefined,
    }

    const response: GetSessionResponse = {
      id: updated.id,
      payload,
      name: updated.name,
      expiresAt: updated.expiresAt.toISOString(),
    }
    return reply.code(200).send(response)
  })

  // DELETE /:id — delete session (requires edit token)
  fastify.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const editToken = req.headers['x-edit-token']
    if (typeof editToken !== 'string' || !editToken) {
      return reply.code(403).send({ error: 'Missing edit token' })
    }

    const session = await prisma.sharedSession.findUnique({
      where: { id: req.params.id },
    })
    if (!session || session.expiresAt < new Date()) {
      return reply.code(404).send({ error: 'Not found' })
    }
    if (session.editToken !== editToken) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    await prisma.sharedSession.delete({ where: { id: req.params.id } })
    return reply.code(204).send()
  })
}
