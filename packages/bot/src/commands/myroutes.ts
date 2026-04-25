import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { prisma } from '../db'

export function registerMyRoutes(bot: Bot<Context>): void {
  // /myroutes — in groups: select active group route; in private chats: list personal saved routes
  bot.command('myroutes', async (ctx) => {
    try {
      const isPrivate = ctx.chat.type === 'private'

      if (isPrivate) {
        // Personal saved routes from web app
        if (!ctx.from) {
          await ctx.reply('Команда доступна только для авторизованных пользователей.')
          return
        }

        const user = await prisma.user.findUnique({
          where: { telegramId: BigInt(ctx.from.id) },
          include: {
            savedRoutes: { orderBy: { createdAt: 'desc' }, take: 10 },
          },
        })

        if (!user || user.savedRoutes.length === 0) {
          await ctx.reply(
            'У тебя нет сохранённых маршрутов.\n\n' +
            'Открой TrailX, спланируй маршрут и сохрани его через панель аккаунта.',
          )
          return
        }

        const lines = user.savedRoutes.map((r, i) => {
          const dist = r.distanceKm != null ? ` — ${r.distanceKm.toFixed(1)} км` : ''
          const elev = r.elevationM != null ? ` ↑${Math.round(r.elevationM)} м` : ''
          return `${i + 1}. ${r.name}${dist}${elev}`
        })

        await ctx.reply(`📍 Твои маршруты:\n\n${lines.join('\n')}`)
        return
      }

      // Group: select active route (former /select behavior)
      const chatId = BigInt(ctx.chat.id)
      const group = await prisma.group.findUnique({
        where: { chatId },
        include: { routes: { orderBy: { updatedAt: 'desc' } } },
      })

      if (!group || group.routes.length === 0) {
        await ctx.reply('Нет маршрутов. Создай через /plan <название>.')
        return
      }

      const keyboard = new InlineKeyboard()
      for (const route of group.routes) {
        const label =
          (route.id === group.activeRouteId ? '✓ ' : '') +
          (route.name ?? route.id)
        keyboard.text(label, `rt:${route.id}`).row()
      }

      await ctx.reply('Выбери активный маршрут:', { reply_markup: keyboard })
    } catch (err) {
      console.error('[/myroutes]', err)
      await ctx.reply('Произошла ошибка. Попробуй позже.')
    }
  })

  // Callback: rt:<routeId> — select active group route
  bot.callbackQuery(/^rt:(.+)$/, async (ctx) => {
    try {
      const routeId = ctx.match[1]

      const route = await prisma.route.findUnique({ where: { id: routeId } })
      if (!route) {
        await ctx.answerCallbackQuery('Маршрут не найден.')
        return
      }

      await prisma.group.update({
        where: { id: route.groupId },
        data: { activeRouteId: routeId },
      })

      await ctx.answerCallbackQuery(`Активен: ${route.name ?? routeId}`)
      await ctx.editMessageText(`✅ Активный маршрут: *${route.name ?? routeId}*`, {
        parse_mode: 'Markdown',
      })
    } catch (err) {
      console.error('[rt: callback]', err)
      await ctx.answerCallbackQuery('Произошла ошибка.')
    }
  })
}
