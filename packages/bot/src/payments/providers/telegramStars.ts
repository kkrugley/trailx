/**
 * Telegram Stars provider.
 *
 * Stars are Telegram's built-in digital currency.
 * - No provider_token needed (pass empty string to sendInvoice)
 * - Currency code: 'XTR'
 * - Prices in whole Stars (not sub-units)
 * - Telegram requires refund support: use bot.api.refundStarPayment(userId, chargeId)
 * - Always available — no configuration required
 */
import type { TelegramInvoiceProvider } from '../IPaymentProvider'
import type { PlanId } from '../plans'
import { getPricingForProviderSafe } from '../../services/pricing'

export class TelegramStarsProvider implements TelegramInvoiceProvider {
  readonly id = 'stars'
  readonly name = 'Telegram Stars'
  readonly emoji = '⭐'
  readonly flow = 'telegram_invoice' as const

  isAvailable(): boolean {
    return true // Always available — no config required
  }

  async supportsPlan(planId: PlanId): Promise<boolean> {
    const pricing = await getPricingForProviderSafe(planId, this.id)
    return pricing !== null && pricing.enabled
  }

  getToken(): string {
    return '' // Stars don't use a provider_token
  }

  getCurrency(_planId: PlanId): string {
    return 'XTR'
  }

  async getAmount(planId: PlanId): Promise<number> {
    const pricing = await getPricingForProviderSafe(planId, this.id)
    if (!pricing) {
      throw new Error(`No pricing found for plan ${planId} and provider ${this.id}`)
    }
    return parseInt(pricing.amount, 10)
  }
}
