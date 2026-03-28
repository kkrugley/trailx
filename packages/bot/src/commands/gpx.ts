import type { Bot, Context } from 'grammy'
import { InputFile } from 'grammy'
import { serializeGPX } from '@trailx/shared'
import type { GPXTrack } from '@trailx/shared'
import { prisma } from '../db'
import { requireSubscription } from '../middleware/requireSubscription'
import type { StoredWaypoint } from '../types'

export function registerGpx(bot: Bot<Context>): void {
  bot.command('gpx', requireSubscription, async (ctx) => {
    try {
      const chatId = BigInt(ctx.chat.id)
      const group = await prisma.group.findUnique({ where: { chatId } })
      const routeId = group?.activeRouteId

      if (!routeId) {
        await ctx.reply('Нет активного маршрута. Создай через /plan <название>.')
        return
      }

      const route = await prisma.route.findUnique({ where: { id: routeId } })
      if (!route) {
        await ctx.reply('Маршрут не найден.')
        return
      }

      const waypoints = route.waypoints as unknown as StoredWaypoint[]
      if (waypoints.length === 0) {
        await ctx.reply('Маршрут пуст. Добавь точки через /add <место>.')
        return
      }

      const track: GPXTrack = {
        name: route.name ?? undefined,
        points: waypoints
          .sort((a, b) => a.order - b.order)
          .map((wp) => ({ lat: wp.lat, lng: wp.lng })),
      }

      const gpxContent = serializeGPX(track, [], route.name ?? 'TrailX Route')
      const buffer = Buffer.from(gpxContent, 'utf-8')
      const filename = `${(route.name ?? 'route').replace(/\s+/g, '_')}.gpx`

      await ctx.replyWithDocument(new InputFile(buffer, filename), {
        caption: `🗺 ${route.name ?? 'TrailX Route'} — ${waypoints.length} точек`,
      })
    } catch (err) {
      console.error('[/gpx]', err)
      await ctx.reply('Произошла ошибка. Попробуй позже.')
    }
  })
}
