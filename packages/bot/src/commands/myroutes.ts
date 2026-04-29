import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { prisma } from '../db'

type Source = 's' | 'b'

interface PendingRename {
  source: Source
  routeId: string
}

const pendingRenames = new Map<number, PendingRename>()

async function buildDmKeyboard(
  telegramId: bigint,
): Promise<{ keyboard: InlineKeyboard; count: number }> {
  const [userResult, botRoutesResult] = await Promise.allSettled([
    prisma.user.findUnique({
      where: { telegramId },
      include: { savedRoutes: { orderBy: { createdAt: 'desc' }, take: 10 } },
    }),
    prisma.route.findMany({
      where: { creatorTelegramId: telegramId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ])

  const savedRoutes =
    userResult.status === 'fulfilled' && userResult.value
      ? userResult.value.savedRoutes
      : []
  const botRoutes = botRoutesResult.status === 'fulfilled' ? botRoutesResult.value : []

  const keyboard = new InlineKeyboard()
  let count = 0

  for (const r of savedRoutes) {
    keyboard.text(r.name, `mr:info:s:${r.id}`).row()
    count++
  }
  for (const r of botRoutes) {
    keyboard.text(`${r.name ?? r.id} [бот]`, `mr:info:b:${r.id}`).row()
    count++
  }

  return { keyboard, count }
}

async function buildGroupKeyboard(chatId: bigint): Promise<{ keyboard: InlineKeyboard; count: number }> {
  const group = await prisma.group.findUnique({
    where: { chatId },
    include: { routes: { orderBy: { updatedAt: 'desc' } } },
  })

  if (!group || group.routes.length === 0) {
    return { keyboard: new InlineKeyboard(), count: 0 }
  }

  const keyboard = new InlineKeyboard()
  for (const route of group.routes) {
    const label = (route.id === group.activeRouteId ? '✓ ' : '') + (route.name ?? route.id)
    keyboard.text(label, `mr:info:b:${route.id}`).row()
  }

  return { keyboard, count: group.routes.length }
}

export function registerMyRoutes(bot: Bot<Context>): void {
  // Text interceptor — registered first to catch pending renames before command routing
  bot.on('message:text', async (ctx, next) => {
    const chatId = ctx.chat.id
    const pending = pendingRenames.get(chatId)

    if (!pending) {
      await next()
      return
    }

    pendingRenames.delete(chatId)

    if (ctx.message.entities?.some((e) => e.type === 'bot_command' && e.offset === 0)) {
      await next()
      return
    }

    const newName = ctx.message.text.trim()
    if (!newName) {
      await ctx.reply('Название не может быть пустым.')
      return
    }

    try {
      if (pending.source === 'b') {
        await prisma.route.update({ where: { id: pending.routeId }, data: { name: newName } })
      } else {
        await prisma.savedRoute.update({ where: { id: pending.routeId }, data: { name: newName } })
      }
      await ctx.reply(`✅ Маршрут переименован в *${newName}*`, { parse_mode: 'Markdown' })
    } catch (err) {
      console.error('[mr rename update]', err)
      await ctx.reply('Произошла ошибка при переименовании.')
    }
  })

  // /myroutes — unified list (DM: saved + bot; group: group routes)
  bot.command('myroutes', async (ctx) => {
    try {
      const isPrivate = ctx.chat.type === 'private'

      if (isPrivate) {
        if (!ctx.from) {
          await ctx.reply('Команда доступна только для авторизованных пользователей.')
          return
        }

        const { keyboard, count } = await buildDmKeyboard(BigInt(ctx.from.id))

        if (count === 0) {
          await ctx.reply(
            'У тебя нет сохранённых маршрутов.\n\n' +
              'Открой TrailX, спланируй маршрут и сохрани его, или создай маршрут через /plan в группе.',
          )
          return
        }

        await ctx.reply('📍 Твои маршруты:', { reply_markup: keyboard })
        return
      }

      // Group
      const chatId = BigInt(ctx.chat.id)
      const { keyboard, count } = await buildGroupKeyboard(chatId)

      if (count === 0) {
        await ctx.reply('Нет маршрутов. Создай через /plan <название>.')
        return
      }

      await ctx.reply('Выбери активный маршрут:', { reply_markup: keyboard })
    } catch (err) {
      console.error('[/myroutes]', err)
      await ctx.reply('Произошла ошибка. Попробуй позже.')
    }
  })

  // mr:info:<source>:<id> — show route sub-menu with details and actions
  bot.callbackQuery(/^mr:info:(s|b):(.+)$/, async (ctx) => {
    try {
      const source = ctx.match[1] as Source
      const id = ctx.match[2]
      const isPrivate = ctx.chat?.type === 'private'

      await ctx.answerCallbackQuery()

      let name: string
      let distanceKm: number | null = null
      let elevationM: number | null = null

      if (source === 's') {
        const r = await prisma.savedRoute.findUnique({
          where: { id },
          select: { name: true, distanceKm: true, elevationM: true },
        })
        if (!r) {
          await ctx.editMessageText('Маршрут не найден.')
          return
        }
        name = r.name
        distanceKm = r.distanceKm
        elevationM = r.elevationM
      } else {
        const r = await prisma.route.findUnique({
          where: { id },
          select: { name: true, distanceKm: true, elevationM: true },
        })
        if (!r) {
          await ctx.editMessageText('Маршрут не найден.')
          return
        }
        name = r.name ?? id
        distanceKm = r.distanceKm
        elevationM = r.elevationM
      }

      const metaParts: string[] = []
      if (distanceKm != null) metaParts.push(`📏 ${distanceKm.toFixed(1)} км`)
      if (elevationM != null) metaParts.push(`↑${Math.round(elevationM)} м`)
      const meta = metaParts.length > 0 ? '\n' + metaParts.join('  ') : ''

      const keyboard = new InlineKeyboard()

      if (isPrivate) {
        keyboard
          .url(
            '📱 Открыть в приложении',
            `https://t.me/${ctx.me.username}/app?startapp=r_${source}_${id}`,
          )
          .row()
      } else {
        keyboard.text('✅ Выбрать активным', `mr:activate:${id}`).row()
      }

      keyboard
        .text('✏️ Переименовать', `mr:rename:${source}:${id}`)
        .text('🗑 Удалить', `mr:delete:${source}:${id}`)
        .row()
        .text('↩️ Назад', 'mr:back')

      await ctx.editMessageText(`📍 *${name}*${meta}`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      })
    } catch (err) {
      console.error('[mr:info callback]', err)
      await ctx.answerCallbackQuery('Произошла ошибка.')
    }
  })

  // mr:activate:<id> — set active route in group
  bot.callbackQuery(/^mr:activate:(.+)$/, async (ctx) => {
    try {
      const routeId = ctx.match[1]
      await ctx.answerCallbackQuery()

      const route = await prisma.route.findUnique({ where: { id: routeId } })
      if (!route) {
        await ctx.editMessageText('Маршрут не найден.')
        return
      }

      await prisma.group.update({
        where: { id: route.groupId },
        data: { activeRouteId: routeId },
      })

      await ctx.editMessageText(`✅ Активный маршрут: *${route.name ?? routeId}*`, {
        parse_mode: 'Markdown',
      })
    } catch (err) {
      console.error('[mr:activate callback]', err)
      await ctx.answerCallbackQuery('Произошла ошибка.')
    }
  })

  // mr:rename:<source>:<id> — initiate rename flow
  bot.callbackQuery(/^mr:rename:(s|b):(.+)$/, async (ctx) => {
    try {
      const source = ctx.match[1] as Source
      const routeId = ctx.match[2]
      await ctx.answerCallbackQuery()

      const chatId = ctx.chat?.id
      if (!chatId) return

      pendingRenames.set(chatId, { source, routeId })
      await ctx.editMessageText('✏️ Введи новое название маршрута:')
    } catch (err) {
      console.error('[mr:rename callback]', err)
      await ctx.answerCallbackQuery('Произошла ошибка.')
    }
  })

  // mr:delete:<source>:<id> — delete route (with ownership check for saved routes)
  bot.callbackQuery(/^mr:delete:(s|b):(.+)$/, async (ctx) => {
    try {
      const source = ctx.match[1] as Source
      const id = ctx.match[2]
      await ctx.answerCallbackQuery()

      if (source === 'b') {
        const route = await prisma.route.findUnique({
          where: { id },
          select: { groupId: true, name: true },
        })
        if (!route) {
          await ctx.editMessageText('Маршрут не найден.')
          return
        }

        await prisma.route.delete({ where: { id } })
        await prisma.group.updateMany({
          where: { id: route.groupId, activeRouteId: id },
          data: { activeRouteId: null },
        })

        await ctx.editMessageText('🗑 Маршрут удалён.')
      } else {
        const route = await prisma.savedRoute.findUnique({
          where: { id },
          select: { user: { select: { telegramId: true } } },
        })
        if (!route) {
          await ctx.editMessageText('Маршрут не найден.')
          return
        }

        const fromId = ctx.from?.id
        if (!fromId || route.user.telegramId !== BigInt(fromId)) {
          await ctx.editMessageText('Нет прав для удаления этого маршрута.')
          return
        }

        await prisma.savedRoute.delete({ where: { id } })
        await ctx.editMessageText('🗑 Маршрут удалён.')
      }
    } catch (err) {
      console.error('[mr:delete callback]', err)
      await ctx.answerCallbackQuery('Произошла ошибка.')
    }
  })

  // mr:back — re-render route list
  bot.callbackQuery(/^mr:back$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery()
      const isPrivate = ctx.chat?.type === 'private'

      if (isPrivate) {
        if (!ctx.from) return
        const { keyboard, count } = await buildDmKeyboard(BigInt(ctx.from.id))
        if (count === 0) {
          await ctx.editMessageText('У тебя нет маршрутов.')
          return
        }
        await ctx.editMessageText('📍 Твои маршруты:', { reply_markup: keyboard })
      } else {
        const chatId = BigInt(ctx.chat?.id ?? 0)
        const { keyboard, count } = await buildGroupKeyboard(chatId)
        if (count === 0) {
          await ctx.editMessageText('Нет маршрутов.')
          return
        }
        await ctx.editMessageText('Выбери активный маршрут:', { reply_markup: keyboard })
      }
    } catch (err) {
      console.error('[mr:back callback]', err)
      await ctx.answerCallbackQuery('Произошла ошибка.')
    }
  })
}
