import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    group: { findUnique: vi.fn(), update: vi.fn() },
    route: { findUnique: vi.fn() },
  },
}))

import { prisma } from '../db'
import { registerMyRoutes } from './myroutes.js'

const mockUser = prisma.user as unknown as Record<string, ReturnType<typeof vi.fn>>
const mockGroup = prisma.group as unknown as Record<string, ReturnType<typeof vi.fn>>

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    chat: { type: 'private', id: 999 },
    from: { id: 123456789 },
    reply: vi.fn().mockResolvedValue(undefined),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    match: [] as unknown,
    ...overrides,
  }
}

function makeBot() {
  const handlers: Record<string, (ctx: unknown) => Promise<void>> = {}
  const cbHandlers: Array<{ pattern: RegExp; handler: (ctx: unknown) => Promise<void> }> = []
  return {
    command: (cmd: string, handler: (ctx: unknown) => Promise<void>) => { handlers[cmd] = handler },
    callbackQuery: (pattern: RegExp, handler: (ctx: unknown) => Promise<void>) => { cbHandlers.push({ pattern, handler }) },
    trigger: async (cmd: string, ctx: unknown) => handlers[cmd]?.(ctx),
    triggerCallback: async (data: string, ctx: unknown) => {
      for (const { pattern, handler } of cbHandlers) {
        const m = data.match(pattern)
        if (m) { (ctx as Record<string, unknown>).match = m; await handler(ctx); return }
      }
    },
  }
}

describe('/myroutes — private chat', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows saved routes when user has them', async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 'u1',
      savedRoutes: [
        { id: 'r1', name: 'Morning Ride', distanceKm: 25.3, elevationM: 200 },
        { id: 'r2', name: 'Forest Loop', distanceKm: null, elevationM: null },
      ],
    })

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx()
    await bot.trigger('myroutes', ctx)

    expect(ctx.reply).toHaveBeenCalledOnce()
    const text = ctx.reply.mock.calls[0][0] as string
    expect(text).toContain('Morning Ride')
    expect(text).toContain('25.3 км')
    expect(text).toContain('Forest Loop')
  })

  it('shows no-routes message when user has no saved routes', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'u1', savedRoutes: [] })

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx()
    await bot.trigger('myroutes', ctx)

    expect(ctx.reply).toHaveBeenCalledOnce()
    const text = ctx.reply.mock.calls[0][0] as string
    expect(text).toContain('нет сохранённых маршрутов')
  })

  it('shows no-routes message when user is not in DB', async () => {
    mockUser.findUnique.mockResolvedValue(null)

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx()
    await bot.trigger('myroutes', ctx)

    expect(ctx.reply).toHaveBeenCalledOnce()
    expect(ctx.reply.mock.calls[0][0]).toContain('нет сохранённых маршрутов')
  })
})

describe('/myroutes — group chat', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows keyboard with group routes', async () => {
    mockGroup.findUnique.mockResolvedValue({
      id: 'g1',
      chatId: BigInt(-100123),
      activeRouteId: 'route-a',
      routes: [
        { id: 'route-a', name: 'Route A', updatedAt: new Date() },
        { id: 'route-b', name: 'Route B', updatedAt: new Date() },
      ],
    })

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx({ chat: { type: 'supergroup', id: -100123 } })
    await bot.trigger('myroutes', ctx)

    expect(ctx.reply).toHaveBeenCalledOnce()
    expect(ctx.reply.mock.calls[0][0]).toContain('активный маршрут')
  })
})
