import { prisma } from '../db'

const ACTIVE_STATUSES = ['member', 'administrator', 'creator'] as const

export async function userHasCommonGroup(telegramId: bigint): Promise<boolean> {
  const count = await prisma.groupMember.count({
    where: {
      telegramId,
      status: { in: [...ACTIVE_STATUSES] },
    },
  })
  return count > 0
}

export async function shouldOfferGroupActivation(userId: bigint): Promise<boolean> {
  return userHasCommonGroup(userId)
}
