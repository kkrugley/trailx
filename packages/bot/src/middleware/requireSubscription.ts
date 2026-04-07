import type { Context, NextFunction } from 'grammy'
import { prisma } from '../db'

/**
 * grammY middleware — verifies the chat has an active, non-expired subscription.
 * Syncs Group.isPro if the subscription has lapsed.
 * Use as: bot.command('gpx', requireSubscription, handler)
 */
export async function requireSubscription(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  const chatId = BigInt(ctx.chat?.id ?? 0)

  const sub = await prisma.subscription.findUnique({ where: { chatId } })
  const now = new Date()
  const isActive = sub?.status === 'active' && sub.expiresAt > now

  // Sync the fast-cache boolean if subscription has lapsed
  if (!isActive) {
    const group = await prisma.group.findUnique({ where: { chatId } })
    if (group?.isPro) {
      await prisma.group.update({ where: { chatId }, data: { isPro: false } })
    }
    // Auto-mark expired subscriptions
    if (sub?.status === 'active' && sub.expiresAt <= now) {
      await prisma.subscription.update({ where: { chatId }, data: { status: 'expired' } })
    }

    await ctx.reply(
      '⚠️ Эта функция доступна только по подписке TrailX Pro.\n' +
      'Используй /upgrade для оформления или продления.',
    )
    return
  }

  await next()
}
