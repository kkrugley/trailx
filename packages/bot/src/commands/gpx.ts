import type { Bot, Context } from 'grammy'
import { InputFile } from 'grammy'
import { serializeGPX } from '@trailx/shared'
import type { GPXTrack, GPXWaypoint } from '@trailx/shared'
import { prisma } from '../db'
import { requireSubscription } from '../middleware/requireSubscription'
import type { StoredWaypoint } from '../types'
import { getUserSettings } from '../services/userSettings'
import { routeWaypoints, GraphHopperError, type GHProfile } from '../services/graphhopper'
import { t } from '../i18n/messages'
import type { Language } from '../i18n/messages'

export function registerGpx(bot: Bot<Context>): void {
  bot.command('gpx', requireSubscription, async (ctx) => {
    const telegramId = BigInt(ctx.from?.id ?? ctx.chat.id)
    const { language: lang, routeProfile } = await getUserSettings(telegramId)

    try {
      const chatId = BigInt(ctx.chat.id)
      const group = await prisma.group.findUnique({ where: { chatId } })
      const routeId = group?.activeRouteId

      if (!routeId) {
        await ctx.reply(t(lang, 'gpxNoRoute'))
        return
      }

      const route = await prisma.route.findUnique({ where: { id: routeId } })
      if (!route) {
        await ctx.reply(t(lang, 'gpxRouteNotFound'))
        return
      }

      const waypoints = route.waypoints as unknown as StoredWaypoint[]
      if (waypoints.length === 0) {
        await ctx.reply(t(lang, 'gpxEmpty'))
        return
      }

      const sorted = [...waypoints].sort((a, b) => a.order - b.order)

      // Build <wpt> markers from original user waypoints
      const wpts: GPXWaypoint[] = sorted.map((wp) => ({
        lat: wp.lat,
        lng: wp.lng,
        name: wp.label,
      }))

      let track: GPXTrack
      let caption: string
      const routeName = route.name ?? 'TrailX Route'

      if (sorted.length >= 2) {
        try {
          const result = await routeWaypoints(
            sorted.map((wp) => [wp.lat, wp.lng]),
            routeProfile as GHProfile,
          )

          // GH returns [lng, lat, ele?] — convert to GPXTrackPoint format
          track = {
            name: routeName,
            points: result.coords.map(([lng, lat, ele]) => ({ lat, lng, ele })),
          }

          caption = t(lang, 'gpxCaptionRouted', {
            name: routeName,
            distance: result.distanceKm,
            ascent: result.ascent,
            profile: routeProfile,
          })
        } catch (err) {
          if (err instanceof GraphHopperError) {
            console.warn('[/gpx] GraphHopper failed, falling back to straight lines:', err.message)
          } else {
            console.error('[/gpx] unexpected routing error:', err)
          }
          track = { name: routeName, points: sorted.map((wp) => ({ lat: wp.lat, lng: wp.lng })) }
          caption =
            `${t(lang, 'gpxCaption', { name: routeName, count: sorted.length })}\n` +
            t(lang, 'gpxCaptionFallback')
        }
      } else {
        // Single waypoint — no routing possible
        track = { name: routeName, points: sorted.map((wp) => ({ lat: wp.lat, lng: wp.lng })) }
        caption = t(lang, 'gpxCaption', { name: routeName, count: sorted.length })
      }

      const gpxContent = serializeGPX(track, wpts, routeName)
      const buffer = Buffer.from(gpxContent, 'utf-8')
      const filename = `${(routeName).replace(/\s+/g, '_')}.gpx`

      await ctx.replyWithDocument(new InputFile(buffer, filename), { caption })
    } catch (err) {
      console.error('[/gpx]', err)
      await ctx.reply(t(lang as Language, 'gpxError'))
    }
  })
}
