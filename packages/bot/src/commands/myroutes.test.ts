import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    group: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    route: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    savedRoute: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}))

import { prisma } from '../db'
import { registerMyRoutes } from './myroutes.js'

const mockUser = prisma.user as unknown as Record<string, ReturnType<typeof vi.fn>>
const mockGroup = prisma.group as unknown as Record<string, ReturnType<typeof vi.fn>>
const mockRoute = prisma.route as unknown as Record<string, ReturnType<typeof vi.fn>>
const mockSavedRoute = prisma.savedRoute as unknown as Record<string, ReturnType<typeof vi.fn>>

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    chat: { type: 'private', id: 999 },
    from: { id: 123456789 },
    me: { username: 'trailxbot' },
    reply: vi.fn().mockResolvedValue(undefined),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    editMessageText: vi.fn().mockResolvedValue(undefined),
    match: [] as unknown,
    message: { text: '', entities: undefined },
    ...overrides,
  }
}

function makeBot() {
  const handlers: Record<string, (ctx: unknown) => Promise<void>> = {}
  const cbHandlers: Array<{ pattern: RegExp; handler: (ctx: unknown) => Promise<void> }> = []
  const textHandlers: Array<(ctx: unknown, next: () => Promise<void>) => Promise<void>> = []

  return {
    command: (cmd: string, handler: (ctx: unknown) => Promise<void>) => {
      handlers[cmd] = handler
    },
    callbackQuery: (pattern: RegExp, handler: (ctx: unknown) => Promise<void>) => {
      cbHandlers.push({ pattern, handler })
    },
    on: (_event: string, handler: (ctx: unknown, next: () => Promise<void>) => Promise<void>) => {
      textHandlers.push(handler)
    },
    trigger: async (cmd: string, ctx: unknown) => handlers[cmd]?.(ctx),
    triggerCallback: async (data: string, ctx: unknown) => {
      for (const { pattern, handler } of cbHandlers) {
        const m = data.match(pattern)
        if (m) {
          ;(ctx as Record<string, unknown>).match = m
          await handler(ctx)
          return
        }
      }
    },
    triggerText: async (ctx: unknown) => {
      let idx = 0
      const next = async (): Promise<void> => {
        if (idx < textHandlers.length) {
          await textHandlers[idx++](ctx, next)
        }
      }
      await next()
    },
  }
}

describe('/myroutes — private chat', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows inline keyboard when user has saved routes', async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 'u1',
      savedRoutes: [
        { id: 'r1', name: 'Morning Ride', distanceKm: 25.3, elevationM: 200 },
      ],
    })
    mockRoute.findMany.mockResolvedValue([])

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx()
    await bot.trigger('myroutes', ctx)

    expect(ctx.reply).toHaveBeenCalledOnce()
    const [, opts] = ctx.reply.mock.calls[0] as [string, { reply_markup: unknown }]
    expect(opts?.reply_markup).toBeDefined()
  })

  it('shows inline keyboard when user has bot routes', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'u1', savedRoutes: [] })
    mockRoute.findMany.mockResolvedValue([
      { id: 'br1', name: 'Bot Route', groupId: 'g1' },
    ])

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx()
    await bot.trigger('myroutes', ctx)

    expect(ctx.reply).toHaveBeenCalledOnce()
    const [, opts] = ctx.reply.mock.calls[0] as [string, { reply_markup: unknown }]
    expect(opts?.reply_markup).toBeDefined()
  })

  it('shows no-routes message when user has no routes at all', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'u1', savedRoutes: [] })
    mockRoute.findMany.mockResolvedValue([])

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
    mockRoute.findMany.mockResolvedValue([])

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
    const [text, opts] = ctx.reply.mock.calls[0] as [string, { reply_markup: unknown }]
    expect(text).toContain('активный маршрут')
    expect(opts?.reply_markup).toBeDefined()
  })

  it('shows no-routes message when group has no routes', async () => {
    mockGroup.findUnique.mockResolvedValue(null)

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx({ chat: { type: 'supergroup', id: -100123 } })
    await bot.trigger('myroutes', ctx)

    expect(ctx.reply).toHaveBeenCalledOnce()
    expect(ctx.reply.mock.calls[0][0]).toContain('Нет маршрутов')
  })
})

describe('mr:info callback', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows sub-menu for saved route (DM)', async () => {
    mockSavedRoute.findUnique.mockResolvedValue({
      name: 'Morning Ride',
      distanceKm: 25.3,
      elevationM: 200,
    })

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx({ chat: { type: 'private', id: 999 } })
    await bot.triggerCallback('mr:info:s:r1', ctx)

    expect(ctx.editMessageText).toHaveBeenCalledOnce()
    const [text, opts] = ctx.editMessageText.mock.calls[0] as [string, { reply_markup: unknown }]
    expect(text).toContain('Morning Ride')
    expect(text).toContain('25.3 км')
    expect(opts?.reply_markup).toBeDefined()
  })

  it('shows sub-menu for bot route (group)', async () => {
    mockRoute.findUnique.mockResolvedValue({
      name: 'Group Route',
      distanceKm: null,
      elevationM: null,
    })

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx({ chat: { type: 'supergroup', id: -100 } })
    await bot.triggerCallback('mr:info:b:br1', ctx)

    expect(ctx.editMessageText).toHaveBeenCalledOnce()
    const [text, opts] = ctx.editMessageText.mock.calls[0] as [string, { reply_markup: unknown }]
    expect(text).toContain('Group Route')
    expect(opts?.reply_markup).toBeDefined()
  })
})

describe('mr:activate callback', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sets active route and confirms', async () => {
    mockRoute.findUnique.mockResolvedValue({ id: 'r1', name: 'Route A', groupId: 'g1' })
    mockGroup.update.mockResolvedValue({})

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx({ chat: { type: 'supergroup', id: -100 } })
    await bot.triggerCallback('mr:activate:r1', ctx)

    expect(mockGroup.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { activeRouteId: 'r1' },
    })
    expect(ctx.editMessageText).toHaveBeenCalledOnce()
    expect(ctx.editMessageText.mock.calls[0][0]).toContain('Route A')
  })
})

describe('mr:rename callback + text handler', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sets pending rename for bot route and renames on next text', async () => {
    mockRoute.update.mockResolvedValue({})

    const bot = makeBot()
    registerMyRoutes(bot as never)

    const ctx = makeCtx({ chat: { type: 'supergroup', id: -100 } })
    await bot.triggerCallback('mr:rename:b:br1', ctx)
    expect(ctx.editMessageText).toHaveBeenCalledOnce()
    expect(ctx.editMessageText.mock.calls[0][0]).toContain('Введи новое название')

    const textCtx = makeCtx({
      chat: { type: 'supergroup', id: -100 },
      message: { text: 'New Name', entities: undefined },
    })
    await bot.triggerText(textCtx)

    expect(mockRoute.update).toHaveBeenCalledWith({
      where: { id: 'br1' },
      data: { name: 'New Name' },
    })
    expect(textCtx.reply).toHaveBeenCalledOnce()
    expect(textCtx.reply.mock.calls[0][0]).toContain('New Name')
  })

  it('sets pending rename for saved route and renames on next text', async () => {
    mockSavedRoute.update.mockResolvedValue({})

    const bot = makeBot()
    registerMyRoutes(bot as never)

    const ctx = makeCtx({ chat: { type: 'private', id: 999 } })
    await bot.triggerCallback('mr:rename:s:sr1', ctx)

    const textCtx = makeCtx({
      chat: { type: 'private', id: 999 },
      message: { text: 'Renamed Route', entities: undefined },
    })
    await bot.triggerText(textCtx)

    expect(mockSavedRoute.update).toHaveBeenCalledWith({
      where: { id: 'sr1' },
      data: { name: 'Renamed Route' },
    })
  })
})

describe('mr:delete callback', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deletes bot route and clears activeRouteId if active', async () => {
    mockRoute.findUnique.mockResolvedValue({ groupId: 'g1', name: 'Route B' })
    mockRoute.delete.mockResolvedValue({})
    mockGroup.updateMany.mockResolvedValue({})

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx({ chat: { type: 'supergroup', id: -100 } })
    await bot.triggerCallback('mr:delete:b:br1', ctx)

    expect(mockRoute.delete).toHaveBeenCalledWith({ where: { id: 'br1' } })
    expect(mockGroup.updateMany).toHaveBeenCalledWith({
      where: { id: 'g1', activeRouteId: 'br1' },
      data: { activeRouteId: null },
    })
    expect(ctx.editMessageText).toHaveBeenCalledOnce()
  })

  it('deletes saved route with ownership check', async () => {
    mockSavedRoute.findUnique.mockResolvedValue({
      user: { telegramId: BigInt(123456789) },
    })
    mockSavedRoute.delete.mockResolvedValue({})

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx({ from: { id: 123456789 } })
    await bot.triggerCallback('mr:delete:s:sr1', ctx)

    expect(mockSavedRoute.delete).toHaveBeenCalledWith({ where: { id: 'sr1' } })
    expect(ctx.editMessageText).toHaveBeenCalledOnce()
  })

  it('rejects saved route deletion for wrong owner', async () => {
    mockSavedRoute.findUnique.mockResolvedValue({
      user: { telegramId: BigInt(999999) },
    })

    const bot = makeBot()
    registerMyRoutes(bot as never)
    const ctx = makeCtx({ from: { id: 123456789 } })
    await bot.triggerCallback('mr:delete:s:sr1', ctx)

    expect(mockSavedRoute.delete).not.toHaveBeenCalled()
    expect(ctx.editMessageText.mock.calls[0][0]).toContain('Нет прав')
  })
})
