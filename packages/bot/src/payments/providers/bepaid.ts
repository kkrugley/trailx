/**
 * bePaid provider — implements TelegramInvoiceProvider.
 * Not currently in use (юридически не подходит), kept for reference.
 *
 * Setup:
 *   1. BotFather → /mybots → your bot → Payments → bePaid.by (test or live)
 *   2. Connect @BePaidPaymentTestBot / @BePaidPaymentBot, provide store ID + public key
 *   3. BotFather returns the provider_token — set BEPAID_PROVIDER_TOKEN in .env
 *
 * Test cards: 4012000000001006 (Visa, no 3DS), 5204240000015003 (MC, no 3DS)
 */
import type { TelegramInvoiceProvider } from '../IPaymentProvider'
import type { PlanId } from '../plans'
import { PLANS } from '../plans'

export class BePaidProvider implements TelegramInvoiceProvider {
  readonly id = 'bepaid'
  readonly name = 'bePaid'
  readonly emoji = '💳'
  readonly flow = 'telegram_invoice' as const

  isAvailable(): boolean {
    return Boolean(process.env.BEPAID_PROVIDER_TOKEN)
  }

  getToken(): string {
    const token = process.env.BEPAID_PROVIDER_TOKEN ?? ''
    if (!token) {
      console.warn('[bePaid] BEPAID_PROVIDER_TOKEN is not set.')
    }
    return token
  }

  getCurrency(_planId: PlanId): string {
    return 'BYN'
  }

  getAmount(planId: PlanId): number {
    return PLANS[planId].amount
  }
}
