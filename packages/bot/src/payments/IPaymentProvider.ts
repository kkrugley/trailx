import type { PlanId } from './plans'

/**
 * Discriminated union of payment provider flows.
 *
 * telegram_invoice — uses Telegram's native sendInvoice flow.
 *   Bot sends an invoice → user pays inside Telegram → bot receives
 *   pre_checkout_query + successful_payment.
 *   Examples: Telegram Stars, WebPay via Telegram Payments.
 *
 * external_link — generates a URL the user opens outside Telegram.
 *   Bot sends a link + instructions. Confirmation is manual (TON)
 *   or via webhook (WebPay redirect flow).
 *   Examples: TON crypto, WebPay redirect.
 */

// ── Base ─────────────────────────────────────────────────────────────────────

interface BaseProvider {
  /** Short identifier used in callback_query data, DB records, logs */
  readonly id: string
  /** Human-readable name for display */
  readonly name: string
  /** Emoji for inline keyboards */
  readonly emoji: string
  /** Returns false if required env vars are missing — hides from UI */
  isAvailable(): boolean
}

// ── Telegram invoice flow ─────────────────────────────────────────────────────

export interface TelegramInvoiceProvider extends BaseProvider {
  readonly flow: 'telegram_invoice'
  /** provider_token from BotFather (empty string for Telegram Stars) */
  getToken(): string
  /** Currency code: 'XTR' for Stars, 'USD' for fiat */
  getCurrency(planId: PlanId): string | Promise<string>
  /** Amount in smallest unit (Stars for XTR, cents for USD) — async to support DB pricing */
  getAmount(planId: PlanId): number | Promise<number>
  /**
   * Check if this provider supports the given plan.
   * Used to filter plans when provider has selective availability.
   */
  supportsPlan?(planId: PlanId): boolean | Promise<boolean>
}

// ── External link flow ────────────────────────────────────────────────────────

export interface ExternalLinkProvider extends BaseProvider {
  readonly flow: 'external_link'
  /** Generates the payment URL (may hit an external API) */
  createPaymentLink(planId: PlanId, chatId: bigint): Promise<string>
  /** Human-readable amount label, e.g. "2 TON" or "5 USD" — async to support DB pricing */
  formatAmount(planId: PlanId): string | Promise<string>
  /** Instructions shown below the link in Telegram — async to support DB pricing */
  getInstructions(planId: PlanId, chatId: bigint): string | Promise<string>
  /**
   * Check if this provider supports the given plan.
   * Used to filter plans when provider has selective availability.
   */
  supportsPlan?(planId: PlanId): boolean | Promise<boolean>
}

// ── Union & type guards ───────────────────────────────────────────────────────

export type IPaymentProvider = TelegramInvoiceProvider | ExternalLinkProvider

export function isTelegramInvoice(p: IPaymentProvider): p is TelegramInvoiceProvider {
  return p.flow === 'telegram_invoice'
}

export function isExternalLink(p: IPaymentProvider): p is ExternalLinkProvider {
  return p.flow === 'external_link'
}
