import type { Bot, Context } from 'grammy'
import { prisma } from '../db'

const APP_URL = process.env.APP_URL ?? 'https://trailx.app'

export function registerApp(bot: Bot<Context>): void {
  bot.command('app', async (ctx) => {
    const chatId = BigInt(ctx.chat.id)
    const group = await prisma.group.findUnique({ where: { chatId } })
    const routeId = group?.activeRouteId

    const url = routeId ? `${APP_URL}?startapp=r_${routeId}` : APP_URL
    const caption = routeId
      ? `🗺 Открыть маршрут в TrailX`
      : `🗺 Открыть TrailX`

    await ctx.reply(caption, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚴 Открыть TrailX', web_app: { url } }],
        ],
      },
    })
  })
}
