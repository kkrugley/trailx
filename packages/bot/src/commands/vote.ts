import type { Bot, Context } from 'grammy'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { geocode } from '../services/geocode'
import { broadcastRouteUpdate } from '../ws/hub'
import { requireSubscription } from '../middleware/requireSubscription'
import type { StoredWaypoint } from '../types'

export function registerVote(bot: Bot<Context>): void {
  // /vote [place] — create a poll to add a waypoint (requires subscription)
  bot.command('vote', requireSubscription, async (ctx) => {
    try {
      const place = ctx.match.trim()
      if (!place) {
        await ctx.reply('Использование: /vote <место>\nПример: /vote Sofiyivka park')
        return
      }

      const chatId = BigInt(ctx.chat.id)
      const group = await prisma.group.findUnique({ where: { chatId } })
      const routeId = group?.activeRouteId

      if (!routeId) {
        await ctx.reply('Нет активного маршрута. Создай через /plan <название>.')
        return
      }

      const coords = await geocode(place)
      if (!coords) {
        await ctx.reply(`Не удалось найти "${place}". Уточни название.`)
        return
      }

      // Create Telegram poll (anonymous, auto-closes in 24 h)
      const pollMsg = await ctx.api.sendPoll(
        ctx.chat.id,
        `Добавить "${coords.name}" в маршрут?`,
        ['Да ✓', 'Нет ✗'],
        {
          is_anonymous: true,
          allows_multiple_answers: false,
          open_period: 1800,
        },
      )

      await prisma.pendingVote.create({
        data: {
          pollId: pollMsg.poll.id,
          chatId,
          place: coords.name,
          routeId,
          lat: coords.lat,
          lng: coords.lng,
        },
      })

      await ctx.reply(
        `📊 Голосование создано! Закроется через 30 мин.\n` +
          `Если большинство проголосует "Да" — "${coords.name}" будет добавлен.`,
      )
    } catch (err) {
      console.error('[/vote]', err)
      await ctx.reply('Произошла ошибка. Попробуй позже.')
    }
  })

  // Handle poll closed — fired when open_period expires or admin closes the poll
  bot.on('poll', async (ctx) => {
    try {
      const poll = ctx.poll
      if (!poll.is_closed) return

      const pending = await prisma.pendingVote.findUnique({
        where: { pollId: poll.id },
      })
      if (!pending) return

      const yesCount = poll.options[0]?.voter_count ?? 0
      const noCount = poll.options[1]?.voter_count ?? 0
      const accepted = yesCount > noCount

      if (accepted) {
        const route = await prisma.route.findUnique({ where: { id: pending.routeId } })
        if (route) {
          const waypoints = route.waypoints as unknown as StoredWaypoint[]
          const updated: StoredWaypoint[] = [
            ...waypoints,
            { lat: pending.lat, lng: pending.lng, label: pending.place, order: waypoints.length },
          ]
          await prisma.route.update({
            where: { id: route.id },
            data: { waypoints: updated as unknown as Prisma.InputJsonValue },
          })
          broadcastRouteUpdate(pending.chatId.toString(), route.id, updated)
        }
        await ctx.api.sendMessage(
          Number(pending.chatId),
          `✅ Голосование завершено: *${pending.place}* добавлен в маршрут! (${yesCount} за, ${noCount} против)`,
          { parse_mode: 'Markdown' },
        )
      } else {
        await ctx.api.sendMessage(
          Number(pending.chatId),
          `❌ Голосование завершено: *${pending.place}* не добавлен. (${yesCount} за, ${noCount} против)`,
          { parse_mode: 'Markdown' },
        )
      }

      await prisma.pendingVote.delete({ where: { pollId: poll.id } })
    } catch (err) {
      console.error('[poll handler]', err)
    }
  })
}
