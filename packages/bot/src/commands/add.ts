import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { geocode, reverseGeocode, type GeocodedPlace } from '../services/geocode'
import { broadcastRouteUpdate } from '../ws/hub'
import type { StoredWaypoint } from '../types'

const FREE_TIER_LIMIT = 3

async function isProUser(chatId: bigint, userId: bigint): Promise<boolean> {
  const groupSub = await prisma.subscription.findFirst({
    where: { chatId, status: 'active', expiresAt: { gt: new Date() } },
  })
  if (groupSub) return true
  const personalSub = await prisma.subscription.findFirst({
    where: { chatId: userId, status: 'active', expiresAt: { gt: new Date() } },
  })
  return !!personalSub
}

// ── In-memory result cache (10 min TTL) ─────────────────────────────────────
// Avoids encoding full place data in callback_data (64-byte Telegram limit).
let cacheSeq = 0
const resultCache = new Map<string, GeocodedPlace[]>()

function cacheResults(results: GeocodedPlace[]): string {
  const key = String(++cacheSeq)
  resultCache.set(key, results)
  setTimeout(() => resultCache.delete(key), 10 * 60 * 1000)
  return key
}

// ── In-memory pending "refine search" state (10 min TTL) ────────────────────
// Key: `${chatId}:${forceReplyMessageId}` → routeId
const pendingRefines = new Map<string, string>()

// ── Search and reply with inline keyboard ────────────────────────────────────
async function doSearch(
  ctx: Context,
  place: string,
  routeId: string,
  waypoints: StoredWaypoint[],
): Promise<void> {
  const results = await geocode(place, waypoints)

  if (results.length === 0) {
    await ctx.reply(`Место "${place}" не найдено. Попробуй /add с более точным запросом.`)
    return
  }

  const cacheKey = cacheResults(results)
  const kb = new InlineKeyboard()
  for (let i = 0; i < results.length; i++) {
    // Callback data: add_wp:{cacheKey}:{index}:{routeId} — stays well under 64 bytes
    kb.text(results[i].name, `add_wp:${cacheKey}:${i}:${routeId}`).row()
  }
  kb.text('🔍 Уточнить поиск', `add_refine:${routeId}`)

  const count = results.length
  const word = count === 1 ? 'место' : count < 5 ? 'места' : 'мест'
  await ctx.reply(`Найдено ${count} ${word}. Выбери нужное:`, { reply_markup: kb })
}

// Pattern: "52.0977 23.7341" or "52.0977,23.7341"
const COORD_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

export function registerAdd(bot: Bot<Context>): void {
  // ── /add command ──────────────────────────────────────────────────────────
  bot.command('add', async (ctx) => {
    try {
      const place = ctx.match.trim()
      if (!place) {
        await ctx.reply(
          'Использование:\n' +
          '/add <место> — поиск по названию\n' +
          '/add <широта> <долгота> — добавить по координатам\n\n' +
          'Пример: /add Брест вокзал\n' +
          'Пример: /add 52.0977 23.7341',
        )
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

      const waypoints = route.waypoints as unknown as StoredWaypoint[]
      const userId = BigInt(ctx.from?.id ?? ctx.chat.id)

      // ── Free-tier limit check ─────────────────────────────────────────────
      if (waypoints.length >= FREE_TIER_LIMIT && !(await isProUser(chatId, userId))) {
        await ctx.reply(
          `⚠️ Бесплатный план позволяет добавить до ${FREE_TIER_LIMIT} точек в маршрут.\n\n` +
          'Оформи TrailX Pro через /upgrade для неограниченного количества точек.',
        )
        return
      }

      // ── Coordinate input shortcut ─────────────────────────────────────────
      const coordMatch = place.match(COORD_RE)
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1])
        const lng = parseFloat(coordMatch[2])
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          const label = (await reverseGeocode(lat, lng)) ?? `${lat}, ${lng}`
          const newWaypoint: StoredWaypoint = {
            lat,
            lng,
            label,
            order: waypoints.length,
          }
          const updated = [...waypoints, newWaypoint]
          await prisma.route.update({
            where: { id: routeId },
            data: { waypoints: updated as unknown as Prisma.InputJsonValue },
          })
          broadcastRouteUpdate(chatId.toString(), routeId, updated)
          await ctx.reply(
            `✅ *${label}* добавлен в маршрут!\nТочек в маршруте: ${updated.length}`,
            { parse_mode: 'Markdown' },
          )
          return
        }
      }

      await doSearch(ctx, place, routeId, waypoints)
    } catch (err) {
      console.error('[/add]', err)
      await ctx.reply('Произошла ошибка. Попробуй позже.')
    }
  })

  // ── Callback: add_wp:{cacheKey}:{index}:{routeId} ─────────────────────────
  bot.callbackQuery(/^add_wp:/, async (ctx) => {
    await ctx.answerCallbackQuery()
    try {
      const parts = ctx.callbackQuery.data.split(':')
      // parts: ['add_wp', cacheKey, index, routeId]
      const [, cacheKey, indexStr, routeId] = parts
      const index = parseInt(indexStr, 10)

      const results = resultCache.get(cacheKey)
      if (!results || !results[index]) {
        await ctx.editMessageText('Время поиска истекло. Повтори /add.')
        return
      }

      const place = results[index]
      const chatId = BigInt(ctx.chat!.id)

      const route = await prisma.route.findUnique({ where: { id: routeId } })
      if (!route) {
        await ctx.editMessageText('Маршрут не найден.')
        return
      }

      const waypoints = route.waypoints as unknown as StoredWaypoint[]
      const userId = BigInt(ctx.from?.id ?? ctx.chat!.id)

      if (waypoints.length >= FREE_TIER_LIMIT && !(await isProUser(chatId, userId))) {
        await ctx.editMessageText(
          `⚠️ Бесплатный план позволяет добавить до ${FREE_TIER_LIMIT} точек в маршрут.\n\n` +
          'Оформи TrailX Pro через /upgrade для неограниченного количества точек.',
        )
        return
      }

      const newWaypoint: StoredWaypoint = {
        lat: place.lat,
        lng: place.lng,
        label: place.name,
        order: waypoints.length,
      }
      const updated = [...waypoints, newWaypoint]

      await prisma.route.update({
        where: { id: routeId },
        data: { waypoints: updated as unknown as Prisma.InputJsonValue },
      })

      broadcastRouteUpdate(chatId.toString(), routeId, updated)

      await ctx.editMessageText(
        `✅ *${place.name}* добавлен в маршрут!\nТочек в маршруте: ${updated.length}`,
        { parse_mode: 'Markdown' },
      )
    } catch (err) {
      console.error('[add_wp callback]', err)
      await ctx.reply('Произошла ошибка. Попробуй позже.')
    }
  })

  // ── Callback: add_refine:{routeId} ────────────────────────────────────────
  bot.callbackQuery(/^add_refine:/, async (ctx) => {
    try {
      const routeId = ctx.callbackQuery.data.slice('add_refine:'.length)
      const sent = await ctx.reply('Введи уточнённый запрос для поиска:', {
        reply_markup: {
          force_reply: true,
          input_field_placeholder: 'Например: Брест, ул. Ленина',
        },
      })
      const key = `${ctx.chat!.id}:${sent.message_id}`
      pendingRefines.set(key, routeId)
      setTimeout(() => pendingRefines.delete(key), 10 * 60 * 1000)
      await ctx.answerCallbackQuery()
    } catch (err) {
      console.error('[add_refine callback]', err)
      await ctx.answerCallbackQuery('Ошибка. Попробуй позже.')
    }
  })

  // ── Handle force-reply responses ──────────────────────────────────────────
  bot.on('message:text', async (ctx, next) => {
    const replyTo = ctx.message.reply_to_message?.message_id
    if (!replyTo) return next()

    const key = `${ctx.chat.id}:${replyTo}`
    const routeId = pendingRefines.get(key)
    if (!routeId) return next()

    pendingRefines.delete(key)

    try {
      const route = await prisma.route.findUnique({ where: { id: routeId } })
      if (!route) {
        await ctx.reply('Маршрут не найден.')
        return
      }

      const waypoints = route.waypoints as unknown as StoredWaypoint[]
      await doSearch(ctx, ctx.message.text, routeId, waypoints)
    } catch (err) {
      console.error('[add refine reply]', err)
      await ctx.reply('Произошла ошибка. Попробуй позже.')
    }
  })
}
