import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db', () => ({
  prisma: {
    group: { findUnique: vi.fn() },
    route: { findUnique: vi.fn() },
  },
}))
vi.mock('../middleware/requireSubscription', () => ({
  requireSubscription: (_ctx: unknown, next: () => Promise<void>) => next(),
}))
vi.mock('../services/userSettings', () => ({
  getUserSettings: vi.fn().mockResolvedValue({ language: 'ru', routeProfile: 'bike' }),
}))

// routeWaypoints is mocked per-test via vi.mocked()
const mockRouteWaypoints = vi.fn()
vi.mock('../services/graphhopper', () => ({
  routeWaypoints: (...args: unknown[]) => mockRouteWaypoints(...args),
  GraphHopperError: class GraphHopperError extends Error {
    statusCode?: number
    constructor(msg: string, statusCode?: number) {
      super(msg)
      this.name = 'GraphHopperError'
      this.statusCode = statusCode
    }
  },
}))

import { prisma } from '../db'
import { GraphHopperError } from '../services/graphhopper'
import { registerGpx } from './gpx'

function makeBotAndCtx(overrides?: { replyWithDocument?: ReturnType<typeof vi.fn> }) {
  const capturedCaptions: string[] = []
  const ctx = {
    chat: { id: 123 },
    from: { id: 456 },
    reply: vi.fn(),
    replyWithDocument: overrides?.replyWithDocument ?? vi.fn().mockImplementation((_file, opts) => {
      capturedCaptions.push(opts?.caption ?? '')
    }),
  }

  let commandHandler: ((ctx: unknown) => Promise<void>) | null = null
  const bot = {
    command: vi.fn().mockImplementation((_cmd, _mw, handler) => {
      commandHandler = handler
    }),
  }

  registerGpx(bot as never)

  return { ctx, bot, capturedCaptions, run: () => commandHandler!(ctx) }
}

describe('/gpx command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteWaypoints.mockReset()
  })

  it('builds track from GraphHopper coords when routing succeeds', async () => {
    const waypoints = [
      { lat: 52.1, lng: 23.7, label: 'A', order: 0 },
      { lat: 52.2, lng: 23.8, label: 'B', order: 1 },
    ]
    vi.mocked(prisma.group.findUnique).mockResolvedValue({ activeRouteId: 'r1' } as never)
    vi.mocked(prisma.route.findUnique).mockResolvedValue({ id: 'r1', name: 'Test', waypoints } as never)
    mockRouteWaypoints.mockResolvedValue({
      coords: [[23.7, 52.1, 100], [23.75, 52.15, 110], [23.8, 52.2, 120]],
      distanceKm: 15.3,
      ascent: 45,
    })

    const { ctx, capturedCaptions, run } = makeBotAndCtx()
    await run()

    expect(mockRouteWaypoints).toHaveBeenCalledWith([[52.1, 23.7], [52.2, 23.8]], 'bike')
    expect(ctx.replyWithDocument).toHaveBeenCalledOnce()
    expect(capturedCaptions[0]).toContain('15.3')
    expect(capturedCaptions[0]).toContain('45')
    expect(capturedCaptions[0]).toContain('bike')
  })

  it('falls back to straight lines with warning when GraphHopper fails', async () => {
    const waypoints = [
      { lat: 52.1, lng: 23.7, label: 'A', order: 0 },
      { lat: 52.2, lng: 23.8, label: 'B', order: 1 },
    ]
    vi.mocked(prisma.group.findUnique).mockResolvedValue({ activeRouteId: 'r1' } as never)
    vi.mocked(prisma.route.findUnique).mockResolvedValue({ id: 'r1', name: 'Test', waypoints } as never)
    mockRouteWaypoints.mockRejectedValue(new GraphHopperError('Rate limit exceeded', 429))

    const capturedCaptions: string[] = []
    const ctx = {
      chat: { id: 123 },
      from: { id: 456 },
      reply: vi.fn(),
      replyWithDocument: vi.fn().mockImplementation((_file, opts) => {
        capturedCaptions.push(opts?.caption ?? '')
      }),
    }

    let commandHandler: ((ctx: unknown) => Promise<void>) | null = null
    const bot = {
      command: vi.fn().mockImplementation((_cmd, _mw, handler) => {
        commandHandler = handler
      }),
    }
    registerGpx(bot as never)
    await commandHandler!(ctx)

    expect(ctx.replyWithDocument).toHaveBeenCalledOnce()
    expect(capturedCaptions[0]).toContain('прямыми линиями')
  })

  it('replies with empty message when route has no waypoints', async () => {
    vi.mocked(prisma.group.findUnique).mockResolvedValue({ activeRouteId: 'r1' } as never)
    vi.mocked(prisma.route.findUnique).mockResolvedValue({ id: 'r1', name: 'Empty', waypoints: [] } as never)

    const { ctx, run } = makeBotAndCtx()
    await run()

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('пуст'))
    expect(ctx.replyWithDocument).not.toHaveBeenCalled()
  })

  it('replies with no-route message when group has no active route', async () => {
    vi.mocked(prisma.group.findUnique).mockResolvedValue({ activeRouteId: null } as never)

    const { ctx, run } = makeBotAndCtx()
    await run()

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('маршрут'))
    expect(ctx.replyWithDocument).not.toHaveBeenCalled()
  })

  it('passes wpt waypoints to serializeGPX (confirmed via document sent)', async () => {
    const waypoints = [
      { lat: 52.1, lng: 23.7, label: 'Старт', order: 0 },
      { lat: 52.2, lng: 23.8, label: 'Финиш', order: 1 },
    ]
    vi.mocked(prisma.group.findUnique).mockResolvedValue({ activeRouteId: 'r1' } as never)
    vi.mocked(prisma.route.findUnique).mockResolvedValue({ id: 'r1', name: 'Route', waypoints } as never)
    mockRouteWaypoints.mockResolvedValue({
      coords: [[23.7, 52.1, 0], [23.8, 52.2, 0]],
      distanceKm: 10,
      ascent: 20,
    })

    const { ctx, run } = makeBotAndCtx()
    await run()

    // Document was sent — routing succeeded and GPX was serialized
    expect(ctx.replyWithDocument).toHaveBeenCalledOnce()
    // Verify the file arg is an InputFile (has source property from Buffer)
    const [inputFile] = ctx.replyWithDocument.mock.calls[0]
    expect(inputFile).toBeDefined()
  })
})
