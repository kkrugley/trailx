import type { Bot, Context } from 'grammy'
import { prisma } from '../db'

/**
 * Upsert a user's membership record for a group.
 * Safe to call on every group interaction — uses upsert to avoid duplicates.
 */
export async function upsertGroupMember(
  groupId: string,
  telegramId: bigint,
  status: string = 'member',
): Promise<void> {
  try {
    await prisma.groupMember.upsert({
      where: { groupId_telegramId: { groupId, telegramId } },
      create: { groupId, telegramId, status },
      update: { status, updatedAt: new Date() },
    })
  } catch (err) {
    console.error('[upsertGroupMember]', err)
  }
}

export function registerChatMember(bot: Bot<Context>): void {
  // ── Bot join / leave ───────────────────────────────────────────────────────
  bot.on('my_chat_member', async (ctx) => {
    try {
      const update = ctx.myChatMember
      const newStatus = update.new_chat_member.status
      const chatId = BigInt(update.chat.id)

      if (newStatus === 'member' || newStatus === 'administrator') {
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

  // ── User join / leave — track GroupMember ─────────────────────────────────
  bot.on('chat_member', async (ctx) => {
    try {
      const update = ctx.chatMember
      const chatId = BigInt(update.chat.id)
      const userId = BigInt(update.new_chat_member.user.id)
      const newStatus = update.new_chat_member.status

      const group = await prisma.group.findUnique({
        where: { chatId },
        select: { id: true },
      })
      if (!group) return

      await upsertGroupMember(group.id, userId, newStatus)
    } catch (err) {
      console.error('[chat_member]', err)
    }
  })
}
