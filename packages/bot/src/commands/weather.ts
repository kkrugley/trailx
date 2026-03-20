import type { Bot, Context } from 'grammy'
import { prisma } from '../db'
import { getWeatherAt, haversineMetres } from '../services/openMeteo'
import { requireSubscription } from '../middleware/requireSubscription'
import type { StoredWaypoint } from '../types'

const AVG_SPEED_MS = (25 * 1000) / 3600 // 25 km/h in m/s

function weatherEmoji(temp: number, precip: number): string {
  if (precip > 1) return '🌧'
  if (precip > 0.1) return '🌦'
  if (temp < 0) return '🥶'
  if (temp > 28) return '☀️'
  return '⛅'
}

function formatHHMM(date: Date): string {
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
}

export function registerWeather(bot: Bot<Context>): void {
  bot.command('weather', requireSubscription, async (ctx) => {
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

    const waypoints = (route.waypoints as unknown as StoredWaypoint[]).sort(
      (a, b) => a.order - b.order,
    )
    if (waypoints.length === 0) {
      await ctx.reply('Маршрут пуст. Добавь точки через /add.')
      return
    }

    // Parse optional start datetime from command args
    const argText = ctx.match.trim()
    let startTime: Date
    if (argText) {
      const parsed = new Date(argText)
      startTime = isNaN(parsed.getTime()) ? new Date() : parsed
    } else {
      startTime = new Date()
    }

    // Sample up to 3 checkpoints: start, midpoint, end
    const indices =
      waypoints.length <= 3
        ? waypoints.map((_, i) => i)
        : [0, Math.floor(waypoints.length / 2), waypoints.length - 1]

    const checkpoints = indices.map((i) => waypoints[i])

    // Calculate cumulative distance to each checkpoint
    const distances: number[] = [0]
    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1]
      const curr = waypoints[i]
      distances.push(
        distances[i - 1] + haversineMetres(prev.lat, prev.lng, curr.lat, curr.lng),
      )
    }

    await ctx.reply('⏳ Получаю прогноз погоды…')

    const lines: string[] = [
      `🌤 *Прогноз погоды для маршрута "${route.name ?? routeId}"*`,
      `🚴 Начало: ${formatHHMM(startTime)}`,
      '',
    ]

    for (const wp of checkpoints) {
      const distM = distances[wp.order] ?? 0
      const etaSec = distM / AVG_SPEED_MS
      const etaTime = new Date(startTime.getTime() + etaSec * 1000)

      const weather = await getWeatherAt(wp.lat, wp.lng, etaTime)
      const label = wp.label ?? `${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}`

      if (weather) {
        const emoji = weatherEmoji(weather.temp, weather.precip)
        lines.push(
          `${emoji} *${label}* — ${formatHHMM(etaTime)}\n` +
            `   🌡 ${weather.temp.toFixed(1)}°C  💨 ${weather.wind.toFixed(0)} км/ч  🌧 ${weather.precip.toFixed(1)} мм`,
        )
      } else {
        lines.push(`⚠️ *${label}* — нет данных`)
      }
      lines.push('')
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' })
  })
}
