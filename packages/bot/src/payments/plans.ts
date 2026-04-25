/**
 * Subscription plan definitions — compatibility layer.
 *
 * ⚠️ DEPRECATED: Prices are now stored in the database (Plan + ProviderPricing tables).
 * Use the new pricing service for all new code:
 *   import { getPlan, getPricingForProvider, getPlans } from '../services/pricing'
 *
 * This file maintains backward compatibility for existing imports.
 * The PLANS object now contains FALLBACK values used only if DB is unavailable.
 */

import {
  Plan as PlanFromService,
  PlanId as PlanIdFromService,
  getPlanSafe,
  getPricingForProviderSafe,
  getPlans,
  FALLBACK_PLANS,
} from '../services/pricing'

// Re-export types for backward compatibility
export type PlanId = PlanIdFromService

/**
 * @deprecated Use Plan from services/pricing instead.
 * This interface includes legacy pricing fields for backward compatibility.
 */
export interface Plan extends PlanFromService {
  // Legacy pricing fields (deprecated, will be removed)
  /** @deprecated Use ProviderPricing via getPricingForProvider() instead */
  amount: number // USD cents (was BYN kopecks)
  /** @deprecated Use ProviderPricing via getPricingForProvider() instead */
  currency: string // 'USD' (was 'BYN')
  /** @deprecated Use ProviderPricing via getPricingForProvider() instead */
  starsAmount: number
  /** @deprecated Use ProviderPricing via getPricingForProvider() instead */
  tonNano: string
  /** @deprecated Use ProviderPricing via getPricingForProvider() instead */
  tonDisplay: string
}

/**
 * @deprecated Prices are now in the database. Use services/pricing for async access.
 * This object contains fallback values for backward compatibility only.
 */
export const PLANS: Record<PlanId, Plan> = {
  monthly: {
    ...FALLBACK_PLANS[0],
    amount: 500, // USD cents
    currency: 'USD',
    starsAmount: 5,
    tonNano: '100000000',
    tonDisplay: '0.1 TON',
  },
  annual: {
    ...FALLBACK_PLANS[1],
    amount: 4500, // USD cents
    currency: 'USD',
    starsAmount: 5,
    tonNano: '100000000',
    tonDisplay: '0.1 TON',
  },
}

// Re-export helper functions
export { isPlanId, calcExpiresAt, daysRemaining, isExpiringSoon } from '../services/pricing'

// Re-export types
export type { ProviderPricing } from '../services/pricing'

/**
 * Get a plan with full pricing info from database.
 * This is the recommended way to access plan data going forward.
 */
export { getPlanSafe as getPlan, getPricingForProviderSafe as getPricingForProvider, getPlans }

// Type helper to build a Plan with pricing from ProviderPricing
export async function buildPlanWithPricing(planId: PlanId): Promise<Plan | null> {
  const plan = await getPlanSafe(planId)
  if (!plan) return null

  // Get all provider pricing for this plan
  const starsPricing = await getPricingForProviderSafe(planId, 'stars')
  const tonPricing = await getPricingForProviderSafe(planId, 'ton')
  const webpayPricing = await getPricingForProviderSafe(planId, 'webpay')

  return {
    ...plan,
    // Default to USD cents from webpay or fallback
    amount: webpayPricing ? parseInt(webpayPricing.amount) : PLANS[planId].amount,
    currency: 'USD',
    // Stars
    starsAmount: starsPricing ? parseInt(starsPricing.amount) : PLANS[planId].starsAmount,
    // TON
    tonNano: tonPricing?.amount ?? PLANS[planId].tonNano,
    tonDisplay: tonPricing?.displayAmount ?? PLANS[planId].tonDisplay,
  }
}
