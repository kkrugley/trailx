import type { Bot, Context } from 'grammy'
import { requireSubscription } from '../middleware/requireSubscription'

// Stage 9: static Strava-style route image generation
export function registerSocial(bot: Bot<Context>): void {
  bot.command('social', requireSubscription, async (ctx) => {
    await ctx.reply('🚧 /social — скоро будет доступно.')
  })
}
