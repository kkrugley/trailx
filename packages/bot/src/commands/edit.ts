import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { prisma } from '../db'

// chatId → routeId awaiting rename
const pendingRenames = new Map<number, string>()

export function registerEdit(bot: Bot<Context>): void {
  // Handle pending renames before any command
  bot.on('message:text', async (ctx, next) => {
    const chatId = ctx.chat.id
    const routeId = pendingRenames.get(chatId)
    if (!routeId) return next()

    pendingRenames.delete(chatId)
    const newName = ctx.message.text.trim()
    if (!newName) {
      await ctx.reply('Название не может быть пустым.')
      return
    }

    try {
      await prisma.route.update({ where: { id: routeId }, data: { name: newName } })
      await ctx.reply(`✅ Маршрут переименован в *${newName}*`, { parse_mode: 'Markdown' })
    } catch (err) {
      console.error('[edit:rename update]', err)
      await ctx.reply('Произошла ошибка при переименовании.')
    }
  })

  // /edit — list routes (no subscription required)
  bot.command('edit', async (ctx) => {
    try {
      const chatId = BigInt(ctx.chat.id)
      const group = await prisma.group.findUnique({
        where: { chatId },
        include: { routes: { orderBy: { updatedAt: 'desc' } } },
      })

      if (!group || group.routes.length === 0) {
        await ctx.reply('Нет маршрутов для редактирования.')
        return
      }

      const keyboard = new InlineKeyboard()
      for (const route of group.routes) {
        keyboard.text(route.name ?? route.id, `edit:select:${route.id}`).row()
      }

      await ctx.reply('Выбери маршрут для редактирования:', { reply_markup: keyboard })
    } catch (err) {
      console.error('[/edit]', err)
      await ctx.reply('Произошла ошибка. Попробуй позже.')
    }
  })

  // Level 1: route selected — show action menu
  bot.callbackQuery(/^edit:select:(.+)$/, async (ctx) => {
    try {
      const routeId = ctx.match[1]
      await ctx.answerCallbackQuery()

      const route = await prisma.route.findUnique({ where: { id: routeId } })
      if (!route) {
        await ctx.editMessageText('Маршрут не найден.')
        return
      }

      const keyboard = new InlineKeyboard()
        .text('🗑 Удалить', `edit:delete:${routeId}`)
        .text('✏️ Переименовать', `edit:rename:${routeId}`)
        .row()
        .text('↩️ Назад', 'edit:back')

      await ctx.editMessageText(
        `Маршрут: *${route.name ?? routeId}*\nВыбери действие:`,
        { parse_mode: 'Markdown', reply_markup: keyboard },
      )
    } catch (err) {
      console.error('[edit:select callback]', err)
      await ctx.answerCallbackQuery('Произошла ошибка.')
    }
  })

  // Action: delete
  bot.callbackQuery(/^edit:delete:(.+)$/, async (ctx) => {
    try {
      const routeId = ctx.match[1]
      await ctx.answerCallbackQuery()

      const route = await prisma.route.findUnique({ where: { id: routeId } })
      if (!route) {
        await ctx.editMessageText('Маршрут не найден.')
        return
      }

      await prisma.route.delete({ where: { id: routeId } })
      await prisma.group.updateMany({
        where: { id: route.groupId, activeRouteId: routeId },
        data: { activeRouteId: null },
      })

      await ctx.editMessageText(
        `🗑 Маршрут *${route.name ?? routeId}* удалён.`,
        { parse_mode: 'Markdown' },
      )
    } catch (err) {
      console.error('[edit:delete callback]', err)
      await ctx.answerCallbackQuery('Произошла ошибка.')
    }
  })

  // Action: rename — store pending state, wait for next text message
  bot.callbackQuery(/^edit:rename:(.+)$/, async (ctx) => {
    try {
      const routeId = ctx.match[1]
      await ctx.answerCallbackQuery()

      const chatId = ctx.chat?.id
      if (!chatId) return

      pendingRenames.set(chatId, routeId)
      await ctx.editMessageText('✏️ Введи новое название маршрута:')
    } catch (err) {
      console.error('[edit:rename callback]', err)
      await ctx.answerCallbackQuery('Произошла ошибка.')
    }
  })

  // Action: back — re-show route list
  bot.callbackQuery('edit:back', async (ctx) => {
    try {
      await ctx.answerCallbackQuery()
      const chatId = BigInt(ctx.chat?.id ?? 0)

      const group = await prisma.group.findUnique({
        where: { chatId },
        include: { routes: { orderBy: { updatedAt: 'desc' } } },
      })

      if (!group || group.routes.length === 0) {
        await ctx.editMessageText('Нет маршрутов.')
        return
      }

      const keyboard = new InlineKeyboard()
      for (const route of group.routes) {
        keyboard.text(route.name ?? route.id, `edit:select:${route.id}`).row()
      }

      await ctx.editMessageText('Выбери маршрут для редактирования:', { reply_markup: keyboard })
    } catch (err) {
      console.error('[edit:back callback]', err)
      await ctx.answerCallbackQuery('Произошла ошибка.')
    }
  })
}
