import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { prisma } from '../db'

export function registerRoute(bot: Bot<Context>): void {
  // /route — list routes for selection
  bot.command('route', async (ctx) => {
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
  })

  // Callback: rt:<routeId>
  bot.callbackQuery(/^rt:(.+)$/, async (ctx) => {
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
  })
}
