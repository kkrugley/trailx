import type { Bot, Context } from 'grammy'
import { prisma } from '../db'

export function registerChatMember(bot: Bot<Context>): void {
  bot.on('my_chat_member', async (ctx) => {
    try {
      const update = ctx.myChatMember
      const newStatus = update.new_chat_member.status
      const chatId = BigInt(update.chat.id)

      if (newStatus === 'member' || newStatus === 'administrator') {
        // Bot was added to a group — ensure Group record exists
        await prisma.group.upsert({
          where: { chatId },
          create: { id: chatId.toString(), chatId },
          update: {},
        })
        console.log(`[my_chat_member] bot added to chat ${chatId} (status: ${newStatus})`)
      } else if (newStatus === 'kicked' || newStatus === 'left') {
        console.log(`[my_chat_member] bot removed from chat ${chatId} (status: ${newStatus})`)
      }
    } catch (err) {
      console.error('[my_chat_member]', err)
    }
  })
}
