import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'

export function registerStart(bot: Bot<Context>): void {
  bot.command('start', async (ctx) => {
    const appUrl = process.env.VITE_APP_URL

    const keyboard = new InlineKeyboard()
    if (appUrl) {
      keyboard.webApp('Открыть TrailX 🗺', appUrl)
    }

    await ctx.reply(
      '*TrailX* — планировщик велосипедных маршрутов\n' +
        'Добавляй точки интереса \\(POI\\), экспортируй GPX и следи за погодой на маршруте\\.\n\n' +
        '*Создать маршрут:* `/plan <название>`\n' +
        'Пример: `/plan Минск → Несвиж`',
      {
        parse_mode: 'MarkdownV2',
        reply_markup: appUrl ? keyboard : undefined,
      },
    )
  })
}
