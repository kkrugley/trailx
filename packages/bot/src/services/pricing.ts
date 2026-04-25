/**
 * Pricing Service — dynamic pricing from database.
 *
 * All plan and pricing data is fetched from the database (Plan + ProviderPricing tables).
 * This allows price changes without redeployment.
 *
 * For native crypto providers (stars, ton, cryptopay), prices are stored in their
 * native units (stars, nanoTON).
 * For fiat providers (webpay, bepaid), prices are stored in USD cents.
 */

import { prisma, type Prisma } from '../db'

// Prisma-generated types
export type PlanFromDB = Prisma.PlanGetPayload<{}>
export type ProviderPricingFromDB = Prisma.ProviderPricingGetPayload<{}>

export type PlanId = 'monthly' | 'annual'

export interface Plan {
  id: PlanId
  label: string
  description: string
  days: number
  isActive: boolean
  sortOrder: number
}

export interface ProviderPricing {
  id: string
  planId: PlanId
  provider: string
  amount: string // Stored as string for precision (nanoTON, stars, USD cents)
  currency: string // 'XTR', 'TON', 'USD'
  displayAmount: string // Human-readable: "5 ⭐", "0.1 TON", "5 USD"
  enabled: boolean
  metadata?: Record<string, unknown> | null
}

// In-memory cache (very short-lived to allow quick price updates)
const CACHE_TTL_MS = 30_000 // 30 seconds
let plansCache: { data: Plan[]; timestamp: number } | null = null
let pricingCache: Map<string, { data: ProviderPricing; timestamp: number }> = new Map()

function getCacheKey(planId: string, provider: string): string {
  return `${planId}:${provider}`
}

/**
 * Check if a value is a valid PlanId
 */
export function isPlanId(value: string): value is PlanId {
  return value === 'monthly' || value === 'annual'
}

/**
 * Get all active plans, ordered by sortOrder
 */
export async function getPlans(): Promise<Plan[]> {
  const now = Date.now()
  if (plansCache && now - plansCache.timestamp < CACHE_TTL_MS) {
    return plansCache.data
  }

  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  // Cast to our interface (Prisma returns compatible shape)
  const result = plans as Plan[]
  plansCache = { data: result, timestamp: now }
  return result
}

/**
 * Get a single plan by ID
 */
export async function getPlan(planId: PlanId): Promise<Plan | null> {
  const plans = await getPlans()
  return plans.find(p => p.id === planId) ?? null
}

/**
 * Get pricing for a specific plan and provider
 */
export async function getPricingForProvider(
  planId: PlanId,
  provider: string
): Promise<ProviderPricing | null> {
  const cacheKey = getCacheKey(planId, provider)
  const cached = pricingCache.get(cacheKey)
  const now = Date.now()

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  const pricing = await prisma.providerPricing.findUnique({
    where: {
      planId_provider: {
        planId,
        provider,
      },
    },
  })

  if (!pricing) {
    return null
  }

  const result = pricing as ProviderPricing
  pricingCache.set(cacheKey, { data: result, timestamp: now })
  return result
}

/**
 * Get all pricing options for a plan
 */
export async function getPricingForPlan(planId: PlanId): Promise<ProviderPricing[]> {
  const pricing = await prisma.providerPricing.findMany({
    where: {
      planId,
      enabled: true,
    },
  })

  return pricing as ProviderPricing[]
}

/**
 * Get all available providers for a plan
 */
export async function getAvailableProvidersForPlan(planId: PlanId): Promise<string[]> {
  const pricing = await prisma.providerPricing.findMany({
    where: {
      planId,
      enabled: true,
    },
    select: { provider: true },
  })

  return pricing.map(p => p.provider)
}

/**
 * Clear all pricing caches. Call this after price updates.
 */
export function clearPricingCache(): void {
  plansCache = null
  pricingCache.clear()
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fallback hardcoded values (used if DB is unavailable)
// These match the seed values in the migration for backward compatibility
// ═══════════════════════════════════════════════════════════════════════════════

export const FALLBACK_PLANS: Plan[] = [
  {
    id: 'monthly',
    label: '1 месяц',
    description: 'TrailX Pro — доступ к групповым маршрутам, командам бота и синхронизации в реальном времени.',
    days: 30,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'annual',
    label: '1 год',
    description: 'TrailX Pro на 12 месяцев — экономия 25% по сравнению с ежемесячной оплатой.',
    days: 365,
    isActive: true,
    sortOrder: 2,
  },
]

export const FALLBACK_PRICING: Record<PlanId, Record<string, ProviderPricing>> = {
  monthly: {
    stars: {
      id: 'fallback-monthly-stars',
      planId: 'monthly',
      provider: 'stars',
      amount: '5',
      currency: 'XTR',
      displayAmount: '5 ⭐',
      enabled: true,
    },
    ton: {
      id: 'fallback-monthly-ton',
      planId: 'monthly',
      provider: 'ton',
      amount: '100000000',
      currency: 'TON',
      displayAmount: '0.1 TON',
      enabled: true,
    },
    cryptopay: {
      id: 'fallback-monthly-cryptopay',
      planId: 'monthly',
      provider: 'cryptopay',
      amount: '100000000',
      currency: 'TON',
      displayAmount: '0.1 TON',
      enabled: true,
    },
    webpay: {
      id: 'fallback-monthly-webpay',
      planId: 'monthly',
      provider: 'webpay',
      amount: '500',
      currency: 'USD',
      displayAmount: '5 USD',
      enabled: true,
    },
    bepaid: {
      id: 'fallback-monthly-bepaid',
      planId: 'monthly',
      provider: 'bepaid',
      amount: '500',
      currency: 'USD',
      displayAmount: '5 USD',
      enabled: false,
    },
  },
  annual: {
    stars: {
      id: 'fallback-annual-stars',
      planId: 'annual',
      provider: 'stars',
      amount: '50',
      currency: 'XTR',
      displayAmount: '50 ⭐',
      enabled: true,
    },
    ton: {
      id: 'fallback-annual-ton',
      planId: 'annual',
      provider: 'ton',
      amount: '1000000000',
      currency: 'TON',
      displayAmount: '1 TON',
      enabled: true,
    },
    cryptopay: {
      id: 'fallback-annual-cryptopay',
      planId: 'annual',
      provider: 'cryptopay',
      amount: '1000000000',
      currency: 'TON',
      displayAmount: '1 TON',
      enabled: true,
    },
    webpay: {
      id: 'fallback-annual-webpay',
      planId: 'annual',
      provider: 'webpay',
      amount: '4500',
      currency: 'USD',
      displayAmount: '45 USD',
      enabled: true,
    },
    bepaid: {
      id: 'fallback-annual-bepaid',
      planId: 'annual',
      provider: 'bepaid',
      amount: '4500',
      currency: 'USD',
      displayAmount: '45 USD',
      enabled: false,
    },
  },
}

/**
 * Get plan with fallback to hardcoded values
 */
export async function getPlanSafe(planId: PlanId): Promise<Plan> {
  try {
    const plan = await getPlan(planId)
    if (plan) return plan
  } catch (error) {
    console.warn('[pricing] DB unavailable, using fallback plan:', error)
  }
  return FALLBACK_PLANS.find(p => p.id === planId) ?? FALLBACK_PLANS[0]
}

/**
 * Get pricing with fallback to hardcoded values
 */
export async function getPricingForProviderSafe(
  planId: PlanId,
  provider: string
): Promise<ProviderPricing | null> {
  try {
    const pricing = await getPricingForProvider(planId, provider)
    if (pricing) return pricing
  } catch (error) {
    console.warn('[pricing] DB unavailable, using fallback pricing:', error)
  }
  return FALLBACK_PRICING[planId]?.[provider] ?? null
}

/**
 * Returns the expiry date for a subscription starting at `from`
 */
export function calcExpiresAt(plan: Plan, from: Date = new Date()): Date {
  return new Date(from.getTime() + plan.days * 24 * 60 * 60 * 1000)
}

/** Days remaining from now until expiresAt (0 if already past) */
export function daysRemaining(expiresAt: Date): number {
  const ms = expiresAt.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

/** True if subscription expires in ≤ 7 days */
export function isExpiringSoon(expiresAt: Date): boolean {
  return daysRemaining(expiresAt) <= 7
}
