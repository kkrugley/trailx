import type { Bot, Context } from 'grammy'
import { prisma } from '../db'

const APP_URL = process.env.VITE_APP_URL ?? 'https://trailx-app.vercel.app'
const BOT_USERNAME = process.env.BOT_USERNAME ?? ''

export function registerApp(bot: Bot<Context>): void {
  bot.command('app', async (ctx) => {
    try {
      const chatId = BigInt(ctx.chat.id)
      const group = await prisma.group.findUnique({ where: { chatId } })
      const routeId = group?.activeRouteId

      const isGroup =
        ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup'

      const caption = routeId ? '🗺 Открыть маршрут в TrailX' : '🗺 Открыть TrailX'

      // In groups web_app buttons are silently rejected by Telegram clients —
      // use a plain url button pointing to the t.me deep-link instead.
      // In private chats (DM) we can use web_app for the in-app launcher.
      const deepLink = routeId
        ? `https://t.me/${BOT_USERNAME}?startapp=r_${routeId}`
        : `https://t.me/${BOT_USERNAME}`

      const button = isGroup
        ? { text: '🚴 Открыть TrailX', url: deepLink }
        : {
            text: '🚴 Открыть TrailX',
            web_app: { url: routeId ? `${APP_URL}?startapp=r_${routeId}` : APP_URL },
          }

      await ctx.reply(caption, {
        reply_markup: { inline_keyboard: [[button]] },
      })
    } catch (err) {
      console.error('[/app]', err)
      await ctx.reply('Произошла ошибка. Попробуй позже.')
    }
  })
}
