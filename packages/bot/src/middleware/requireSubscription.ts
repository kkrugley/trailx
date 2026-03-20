import type { Context, NextFunction } from 'grammy'
import { prisma } from '../db'

/**
 * grammY middleware — verifies the chat has an active subscription (isPro).
 * Use as: bot.command('gpx', requireSubscription, handler)
 */
export async function requireSubscription(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  const chatId = BigInt(ctx.chat?.id ?? 0)
  const group = await prisma.group.findUnique({ where: { chatId } })

  if (!group?.isPro) {
    await ctx.reply(
      '⚠️ Эта функция доступна только по подписке.\nИспользуй /upgrade для оформления.',
    )
    return
  }

  await next()
}
