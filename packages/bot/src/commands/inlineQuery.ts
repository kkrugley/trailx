import type { Bot, Context } from 'grammy'
import type { InlineQueryResultArticle } from 'grammy/types'
import { prisma } from '../db'

export function registerInlineQuery(bot: Bot<Context>): void {
  bot.on('inline_query', async (ctx) => {
    try {
      const query = ctx.inlineQuery.query.trim()

      const routes = await prisma.route.findMany({
        where: query
          ? { name: { contains: query, mode: 'insensitive' } }
          : {},
        orderBy: { updatedAt: 'desc' },
        take: 5,
      })

      const results: InlineQueryResultArticle[] = routes.map((r) => ({
        type: 'article' as const,
        id: r.id,
        title: r.name ?? r.id,
        description: `ID: ${r.id}`,
        input_message_content: {
          message_text:
            `🗺 *${r.name ?? r.id}*\n` +
            `ID: \`${r.id}\`\n` +
            `Точек: ${(r.waypoints as unknown[]).length}`,
          parse_mode: 'Markdown' as const,
        },
      }))

      await ctx.answerInlineQuery(results, { cache_time: 10 })
    } catch (err) {
      console.error('[inline_query]', err)
      await ctx.answerInlineQuery([], { cache_time: 0 })
    }
  })
}
