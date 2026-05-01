import { prisma } from '../db'

export type Language = 'ru' | 'en'
export type RouteProfile = 'bike' | 'racingbike' | 'mtb' | 'foot'

export interface UserSettingsData {
  language: Language
  routeProfile: RouteProfile
}

const DEFAULTS: UserSettingsData = {
  language: 'ru',
  routeProfile: 'bike',
}

// Simple in-memory cache (60 sec TTL) to avoid hitting DB on every callback
const cache = new Map<bigint, { data: UserSettingsData; expiresAt: number }>()

export async function getUserSettings(telegramId: bigint): Promise<UserSettingsData> {
  const cached = cache.get(telegramId)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const row = await prisma.userSettings.findUnique({ where: { telegramId } })
  const data: UserSettingsData = row
    ? { language: row.language as Language, routeProfile: row.routeProfile as RouteProfile }
    : { ...DEFAULTS }

  cache.set(telegramId, { data, expiresAt: Date.now() + 60_000 })
  return data
}

export async function updateUserSettings(
  telegramId: bigint,
  patch: Partial<UserSettingsData>,
): Promise<UserSettingsData> {
  const current = await getUserSettings(telegramId)
  const next = { ...current, ...patch }

  await prisma.userSettings.upsert({
    where: { telegramId },
    create: { telegramId, ...next },
    update: next,
  })

  cache.set(telegramId, { data: next, expiresAt: Date.now() + 60_000 })
  return next
}
