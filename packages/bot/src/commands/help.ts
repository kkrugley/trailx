import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'

const APP_URL = process.env.VITE_APP_URL ?? 'https://trailx-app.vercel.app'

export function registerHelp(bot: Bot<Context>): void {
  bot.command('help', async (ctx) => {
    try {
      // url button (not web_app) so /help works in groups too
      const keyboard = new InlineKeyboard()
        .url('🌐 Открыть TrailX', APP_URL)

      await ctx.reply(
        '🚴 *TrailX Bot* — совместное планирование веломаршрутов\n\n' +
          '*Бесплатно:*\n' +
          '/plan <название> — создать новый маршрут\n' +
          '/route — выбрать активный маршрут\n' +
          '/delete — удалить маршрут\n' +
          '/app — открыть мини-приложение с маршрутом\n' +
          '/upgrade — оформить подписку\n' +
          '/help — эта справка\n\n' +
          '*По подписке:*\n' +
          '/add <место> — добавить точку в маршрут\n' +
          '/vote <место> — создать голосование за точку\n' +
          '/gpx — скачать маршрут в формате GPX\n' +
          '/weather [дата] — прогноз погоды по маршруту\n' +
          '/social — поделиться маршрутом (скоро)\n\n' +
          'Начни с /plan, затем добавь точки через /add.',
        { parse_mode: 'Markdown', reply_markup: keyboard },
      )
    } catch (err) {
      console.error('[/help]', err)
      await ctx.reply('Произошла ошибка. Попробуй позже.')
    }
  })
}
