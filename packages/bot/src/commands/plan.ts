import type { Bot, Context } from 'grammy'
import { prisma } from '../db'

export function registerPlan(bot: Bot<Context>): void {
  bot.command('plan', async (ctx) => {
    const chatId = BigInt(ctx.chat.id)
    const name = ctx.match.trim() || 'Новый маршрут'

    // Ensure Group record exists
    const group = await prisma.group.upsert({
      where: { chatId },
      create: { id: chatId.toString(), chatId },
      update: {},
    })

    const route = await prisma.route.create({
      data: {
        groupId: group.id,
        name,
        waypoints: [],
      },
    })

    // Make the new route active automatically
    await prisma.group.update({
      where: { id: group.id },
      data: { activeRouteId: route.id },
    })

    await ctx.reply(
      `🗺 Маршрут *${name}* создан!\n` +
        `ID: \`${route.id}\`\n\n` +
        `Добавляй точки через /add <место> или открой приложение через /app`,
      { parse_mode: 'Markdown' },
    )
  })
}
