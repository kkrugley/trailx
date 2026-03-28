import type { Bot, Context } from 'grammy'

// Stage 8: Telegram Payments subscription management
export function registerUpgrade(bot: Bot<Context>): void {
  bot.command('upgrade', async (ctx) => {
    try {
      await ctx.reply('🚧 /upgrade — скоро будет доступно.')
    } catch (err) {
      console.error('[/upgrade]', err)
    }
  })
}
