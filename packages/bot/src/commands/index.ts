import type { Bot, Context } from 'grammy'
import { prisma } from '../db'
import { registerPaymentHandlers } from '../payments'
import { registerStart } from './start'
import { registerPlan } from './plan'
import { registerMyRoutes } from './myroutes'
import { registerApp } from './app'
import { registerAdd } from './add'
import { registerVote } from './vote'
import { registerGpx } from './gpx'
import { registerWeather } from './weather'
import { registerSocial } from './social'
import { registerUpgrade } from './upgrade'
import { registerHelp } from './help'
import { registerInlineQuery } from './inlineQuery'
import { registerChatMember, upsertGroupMember } from './chatMember'

export function registerCommands(bot: Bot<Context>): void {
  // ── Group membership tracking middleware ──────────────────────────────────
  // Captures any user who sends a message/callback in a known group, so that
  // group routes can be shown to them in the web app without relying solely
  // on Telegram's chat_member events (which require explicit allowance).
  bot.use(async (ctx, next) => {
    if (ctx.from && ctx.chat && ctx.chat.type !== 'private') {
      const chatId = BigInt(ctx.chat.id)
      const group = await prisma.group.findUnique({
        where: { chatId },
        select: { id: true },
      })
      if (group) {
        void upsertGroupMember(group.id, BigInt(ctx.from.id))
      }
    }
    return next()
  })

  registerStart(bot)
  registerPlan(bot)
  registerMyRoutes(bot)
  registerApp(bot)
  registerAdd(bot)
  registerVote(bot)
  registerGpx(bot)
  registerWeather(bot)
  registerSocial(bot)
  registerUpgrade(bot)
  registerPaymentHandlers(bot)
  registerHelp(bot)
  registerInlineQuery(bot)
  registerChatMember(bot)
}
