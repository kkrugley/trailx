import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { Bot } from 'grammy'
import { prisma } from './db'
import { registerCommands } from './commands'
import { registerClient, unregisterClient } from './ws/hub'
import { sessionRoutes } from './routes/sessions'
import type { StoredWaypoint } from './types'

// ── Environment ────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.BOT_TOKEN ?? ''
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? ''
const PORT = Number(process.env.PORT ?? 3001)
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN ?? ''

if (!BOT_TOKEN) throw new Error('BOT_TOKEN env var is required')

// ── Bot ────────────────────────────────────────────────────────────────────

const bot = new Bot(BOT_TOKEN)
registerCommands(bot)

bot.catch((err) => {
  console.error('Bot error while handling update', err.ctx.update.update_id, err.error)
})

// ── Fastify ────────────────────────────────────────────────────────────────

const fastify = Fastify({ logger: true })

await fastify.register(cors, {
  origin: (origin, cb) => {
    const allowed = [
      'https://trailx-app.vercel.app',
      'http://localhost:5173',
    ]
    if (!origin || allowed.some(o => origin.startsWith(o))) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed'), false)
    }
  },
  credentials: true,
})

await fastify.register(websocket)

// Telegram webhook endpoint
fastify.post('/webhook/bot', {
  config: { rawBody: true },
}, async (req, reply) => {
  // Validate secret token header
  const secret = (req.headers['x-telegram-bot-api-secret-token'] as string | undefined) ?? ''
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return reply.code(403).send({ error: 'Forbidden' })
  }
  await bot.handleUpdate(req.body as Parameters<typeof bot.handleUpdate>[0])
  return reply.code(200).send({ ok: true })
})

// REST API — used by the Mini App to load a shared route via deep link
fastify.get<{ Params: { id: string } }>('/routes/:id', async (req, reply) => {
  const route = await prisma.route.findUnique({ where: { id: req.params.id } })
  if (!route) return reply.code(404).send({ error: 'Not found' })

  return {
    id: route.id,
    name: route.name ?? '',
    waypoints: (route.waypoints as unknown as StoredWaypoint[]).map((wp) => ({
      lat: wp.lat,
      lng: wp.lng,
      name: wp.label,
    })),
  }
})

// Session sharing REST API
fastify.register(sessionRoutes, { prefix: '/api/sessions' })

// WebSocket endpoint — TMA clients subscribe by chatId
fastify.get<{ Querystring: { chatId?: string } }>(
  '/ws',
  { websocket: true },
  (socket, req) => {
    const chatId = req.query.chatId ?? ''
    if (chatId) registerClient(chatId, socket)

    socket.on('close', () => {
      if (chatId) unregisterClient(chatId, socket)
    })
  },
)

// ── Start ──────────────────────────────────────────────────────────────────

await bot.init()

await fastify.listen({ port: PORT, host: '0.0.0.0' })

// Hourly cleanup of expired sessions
setInterval(async () => {
  const { count } = await prisma.sharedSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  if (count > 0) console.log(`Cleaned up ${count} expired sessions`)
}, 60 * 60 * 1000)

if (WEBHOOK_DOMAIN) {
  const webhookUrl = `${WEBHOOK_DOMAIN}/webhook/bot`
  await bot.api.setWebhook(webhookUrl, {
    secret_token: WEBHOOK_SECRET || undefined,
    allowed_updates: ['message', 'callback_query', 'poll', 'poll_answer'],
  })
  console.log(`Webhook set: ${webhookUrl}`)
} else {
  // Local dev: use long polling
  console.log('Starting long polling...')
  void bot.start({ allowed_updates: ['message', 'callback_query', 'poll', 'poll_answer'] })
}
