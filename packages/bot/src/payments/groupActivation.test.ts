import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCount = vi.fn()

vi.mock('../db', () => ({
  prisma: {
    groupMember: {
      count: mockCount,
    },
  },
}))

const { userHasCommonGroup, shouldOfferGroupActivation } = await import('./groupActivation')

describe('userHasCommonGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when user has at least one active group membership', async () => {
    mockCount.mockResolvedValue(2)
    expect(await userHasCommonGroup(123n)).toBe(true)
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        telegramId: 123n,
        status: { in: ['member', 'administrator', 'creator'] },
      },
    })
  })

  it('returns false when user has no active group memberships', async () => {
    mockCount.mockResolvedValue(0)
    expect(await userHasCommonGroup(456n)).toBe(false)
  })

  it('excludes left and kicked statuses', async () => {
    mockCount.mockResolvedValue(0)
    await userHasCommonGroup(789n)
    const call = mockCount.mock.calls[0][0]
    expect(call.where.status.in).not.toContain('left')
    expect(call.where.status.in).not.toContain('kicked')
  })
})

describe('shouldOfferGroupActivation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when user has common groups', async () => {
    mockCount.mockResolvedValue(1)
    expect(await shouldOfferGroupActivation(111n)).toBe(true)
  })

  it('returns false when user has no common groups', async () => {
    mockCount.mockResolvedValue(0)
    expect(await shouldOfferGroupActivation(222n)).toBe(false)
  })
})
