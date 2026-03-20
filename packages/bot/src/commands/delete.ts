import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { prisma } from '../db'

export function registerDelete(bot: Bot<Context>): void {
  bot.command('delete', async (ctx) => {
    const chatId = BigInt(ctx.chat.id)
    const group = await prisma.group.findUnique({
      where: { chatId },
      include: { routes: { orderBy: { updatedAt: 'desc' } } },
    })

    if (!group || group.routes.length === 0) {
      await ctx.reply('Нет маршрутов для удаления.')
      return
    }

    const keyboard = new InlineKeyboard()
    for (const route of group.routes) {
      keyboard.text(`🗑 ${route.name ?? route.id}`, `del:${route.id}`).row()
    }
    keyboard.text('Отмена', 'del:cancel')

    await ctx.reply('Какой маршрут удалить?', { reply_markup: keyboard })
  })

  bot.callbackQuery(/^del:(.+)$/, async (ctx) => {
    const id = ctx.match[1]
    await ctx.answerCallbackQuery()

    if (id === 'cancel') {
      await ctx.editMessageText('Отменено.')
      return
    }

    const route = await prisma.route.findUnique({ where: { id } })
    if (!route) {
      await ctx.editMessageText('Маршрут не найден.')
      return
    }

    await prisma.route.delete({ where: { id } })

    // Clear activeRouteId on the group if it was pointing to this route
    await prisma.group.updateMany({
      where: { id: route.groupId, activeRouteId: id },
      data: { activeRouteId: null },
    })

    await ctx.editMessageText(
      `🗑 Маршрут *${route.name ?? id}* удалён.`,
      { parse_mode: 'Markdown' },
    )
  })
}
