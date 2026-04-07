/**
 * Subscription plan definitions — app-level business logic, provider-agnostic.
 *
 * Prices:
 *   amount      — BYN kopecks (1 BYN = 100 kopecks), used by WebPay
 *   starsAmount — Telegram Stars (integer), used by TelegramStarsProvider
 *   tonNano     — nanoTON string (1 TON = 1_000_000_000 nanoton), used by TonProvider
 *   tonDisplay  — human-readable TON amount, e.g. "2 TON"
 */

export type PlanId = 'monthly' | 'annual'

export interface Plan {
  id: PlanId
  label: string
  description: string
  // Fiat (BYN)
  amount: number    // kopecks
  currency: string  // 'BYN'
  days: number
  // Telegram Stars
  starsAmount: number
  // TON crypto
  tonNano: string   // string to avoid precision issues
  tonDisplay: string
}

export const PLANS: Record<PlanId, Plan> = {
  monthly: {
    id: 'monthly',
    label: '1 месяц',
    description: 'TrailX Pro — доступ к групповым маршрутам, командам бота и синхронизации в реальном времени.',
    amount: 500,
    currency: 'BYN',
    days: 30,
    starsAmount: 5,
    tonNano: '100000000',    // 0.1 TON
    tonDisplay: '0.1 TON',
  },
  annual: {
    id: 'annual',
    label: '1 год',
    description: 'TrailX Pro на 12 месяцев — экономия 25% по сравнению с ежемесячной оплатой.',
    amount: 4500,
    currency: 'BYN',
    days: 365,
    starsAmount: 5,
    tonNano: '100000000',    // 0.1 TON
    tonDisplay: '0.1 TON',
  },
}

export function isPlanId(value: string): value is PlanId {
  return value === 'monthly' || value === 'annual'
}

/** Returns the expiry date for a subscription starting at `from` */
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
