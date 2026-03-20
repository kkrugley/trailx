import type { Bot, Context } from 'grammy'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { geocode } from '../services/geocode'
import { broadcastRouteUpdate } from '../ws/hub'
import type { StoredWaypoint } from '../types'

export function registerAdd(bot: Bot<Context>): void {
  bot.command('add', async (ctx) => {
    const place = ctx.match.trim()
    if (!place) {
      await ctx.reply('Использование: /add <место>\nПример: /add Киев вокзал')
      return
    }

    const chatId = BigInt(ctx.chat.id)
    const group = await prisma.group.findUnique({ where: { chatId } })
    const routeId = group?.activeRouteId

    if (!routeId) {
      await ctx.reply('Нет активного маршрута. Создай через /plan <название>.')
      return
    }

    const route = await prisma.route.findUnique({ where: { id: routeId } })
    if (!route) {
      await ctx.reply('Активный маршрут не найден.')
      return
    }

    const coords = await geocode(place)
    if (!coords) {
      await ctx.reply(`Не удалось найти "${place}". Уточни название.`)
      return
    }

    const waypoints = route.waypoints as unknown as StoredWaypoint[]
    const newWaypoint: StoredWaypoint = {
      lat: coords.lat,
      lng: coords.lng,
      label: coords.name,
      order: waypoints.length,
    }
    const updated = [...waypoints, newWaypoint]

    await prisma.route.update({
      where: { id: routeId },
      data: { waypoints: updated as unknown as Prisma.InputJsonValue },
    })

    broadcastRouteUpdate(chatId.toString(), routeId, updated)

    await ctx.reply(
      `📍 *${coords.name}* добавлен в маршрут!\n` +
        `Точек в маршруте: ${updated.length}`,
      { parse_mode: 'Markdown' },
    )
  })
}
