import type { Bot, Context } from 'grammy'
import type { InlineQueryResultArticle } from 'grammy/types'
import { prisma } from '../db'

export function registerInlineQuery(bot: Bot<Context>): void {
  bot.on('inline_query', async (ctx) => {
    try {
      const query = ctx.inlineQuery.query.trim()
      const userId = ctx.inlineQuery.from.id

      // Resolve groups the user belongs to (check membership via Telegram API)
      const groups = await prisma.group.findMany({ select: { id: true, chatId: true } })

      const memberGroupIds = (await Promise.allSettled(
        groups.map(async (g) => {
          const member = await ctx.api.getChatMember(Number(g.chatId), userId)
          if (['member', 'administrator', 'creator'].includes(member.status)) {
            return g.id
          }
          return null
        }),
      ))
        .filter((r): r is PromiseFulfilledResult<string> =>
          r.status === 'fulfilled' && r.value !== null,
        )
        .map((r) => r.value)

      if (memberGroupIds.length === 0) {
        await ctx.answerInlineQuery([], { cache_time: 60 })
        return
      }

      const routes = await prisma.route.findMany({
        where: {
          groupId: { in: memberGroupIds },
          ...(query ? { name: { contains: query, mode: 'insensitive' as const } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      })

      const results: InlineQueryResultArticle[] = routes.map((r) => ({
        type: 'article' as const,
        id: r.id,
        title: r.name ?? r.id,
        description: `Точек: ${(r.waypoints as unknown[]).length}`,
        input_message_content: {
          message_text:
            `🗺 *${r.name ?? 'Маршрут'}*\n` +
            `Точек: ${(r.waypoints as unknown[]).length}`,
          parse_mode: 'Markdown' as const,
        },
      }))

      await ctx.answerInlineQuery(results, { cache_time: 300 })
    } catch (err) {
      console.error('[inline_query]', err)
      await ctx.answerInlineQuery([], { cache_time: 0 })
    }
  })
}
