import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db', () => ({
  prisma: {
    subscription: { upsert: vi.fn() },
    paymentRecord: { create: vi.fn() },
    group: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('./plans', () => ({
  isPlanId: (id: string) => id === 'monthly' || id === 'annual',
  calcExpiresAt: () => new Date('2027-01-01'),
}))

vi.mock('../services/pricing', () => ({
  getPlanSafe: vi.fn().mockResolvedValue({ label: 'Pro Monthly' }),
}))

vi.mock('./groupActivation', () => ({
  shouldOfferGroupActivation: vi.fn(),
}))

import { prisma } from '../db'
import { shouldOfferGroupActivation } from './groupActivation'
import { registerPaymentHandlers } from './telegramPayments'

const mockShouldOffer = vi.mocked(shouldOfferGroupActivation)
const mockTransaction = vi.mocked(prisma.$transaction)
const mockUpsert = vi.mocked(prisma.subscription.upsert)

function makeBot() {
  const handlers: Record<string, (ctx: unknown) => Promise<void>> = {}
  const bot = {
    on: vi.fn().mockImplementation((event: string, handler: (ctx: unknown) => Promise<void>) => {
      handlers[event] = handler
    }),
  }
  registerPaymentHandlers(bot as never)
  return { bot, handlers }
}

function makePaymentCtx(overrides: {
  chatId: number
  userId: number
  planId?: string
  currency?: string
}) {
  const { chatId, userId, planId = 'monthly', currency = 'XTR' } = overrides
  const replies: Array<{ text: string; markup?: unknown }> = []
  return {
    ctx: {
      chat: { id: chatId },
      from: { id: userId },
      message: {
        successful_payment: {
          invoice_payload: planId,
          currency,
          total_amount: 1,
          telegram_payment_charge_id: 'charge_123',
          provider_payment_charge_id: null,
        },
      },
      reply: vi.fn().mockImplementation((text: string, opts?: { reply_markup?: unknown }) => {
        replies.push({ text, markup: opts?.reply_markup })
      }),
    },
    replies,
  }
}

describe('registerPaymentHandlers — successful_payment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mockTransaction as any).mockImplementation(async (ops: Promise<unknown>[]) => {
      await Promise.all(ops)
    })
    mockUpsert.mockResolvedValue({} as never)
    vi.mocked(prisma.paymentRecord.create).mockResolvedValue({} as never)
    vi.mocked(prisma.group.upsert).mockResolvedValue({} as never)
  })

  it('does not show activation button when purchased in a group chat', async () => {
    const { handlers } = makeBot()
    mockShouldOffer.mockResolvedValue(true)
    // Group chat: chat.id !== from.id
    const { ctx, replies } = makePaymentCtx({ chatId: -100987654, userId: 111 })

    await handlers['message:successful_payment'](ctx)

    expect(replies).toHaveLength(1)
    expect(replies[0].markup).toBeUndefined()
  })

  it('does not show button when user has no common groups', async () => {
    const { handlers } = makeBot()
    mockShouldOffer.mockResolvedValue(false)
    // Private chat: chat.id === from.id
    const { ctx, replies } = makePaymentCtx({ chatId: 111, userId: 111 })

    await handlers['message:successful_payment'](ctx)

    expect(replies).toHaveLength(1)
    expect(replies.some((r) => r.markup !== undefined)).toBe(false)
  })

  it('shows activation button when private chat and user has common groups', async () => {
    const { handlers } = makeBot()
    mockShouldOffer.mockResolvedValue(true)
    // Private chat: chat.id === from.id
    const { ctx, replies } = makePaymentCtx({ chatId: 222, userId: 222 })

    await handlers['message:successful_payment'](ctx)

    expect(replies).toHaveLength(2)
    expect(replies[1].markup).toBeDefined()
    expect(replies[1].text).toContain('групповых чатов')
    expect(mockShouldOffer).toHaveBeenCalledWith(BigInt(222))
  })

  it('resets linkedGroupChatId in upsert update on renewal', async () => {
    const { handlers } = makeBot()
    mockShouldOffer.mockResolvedValue(false)

    let capturedUpdate: Record<string, unknown> | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mockUpsert as any).mockImplementation((args: { update: Record<string, unknown> }) => {
      capturedUpdate = args.update
      return Promise.resolve({})
    })

    const { ctx } = makePaymentCtx({ chatId: 333, userId: 333 })
    await handlers['message:successful_payment'](ctx)

    expect(capturedUpdate).toBeDefined()
    expect(capturedUpdate!['linkedGroupChatId']).toBeNull()
  })

  it('ignores unknown plan ids', async () => {
    const { handlers } = makeBot()
    const { ctx, replies } = makePaymentCtx({ chatId: 444, userId: 444, planId: 'unknown_plan' })

    await handlers['message:successful_payment'](ctx)

    expect(replies).toHaveLength(0)
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})
