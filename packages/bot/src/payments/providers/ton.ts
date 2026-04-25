/**
 * TON Center provider — direct TON wallet monitoring via toncenter.com API.
 *
 * Flow: user pays to wallet with unique memo → poller detects tx → activate subscription.
 * No middleman (unlike Crypto Pay) — any TON wallet works.
 *
 * Setup:
 * TON_WALLET_ADDRESS — raw TON address (EQ...) of the receiving wallet.
 * .ton domain does NOT work with toncenter.com API — you need the raw address.
 * Resolve: tonviewer.com → paste "industrial-design.ton" → copy address (EQ...)
 * TONCENTER_API_KEY — optional, raises rate limit from 1 to 10 req/sec.
 * Get at: https://toncenter.com/
 *
 * Confirmation: background poller in src/services/tonPoller.ts (every 10 sec).
 * Delay: up to ~10 seconds after payment.
 */
import type { ExternalLinkProvider } from '../IPaymentProvider'
import type { PlanId } from '../plans'
import { getPricingForProviderSafe } from '../../services/pricing'

export class TonCenterProvider implements ExternalLinkProvider {
  readonly id = 'ton'
  readonly name = 'TON напрямую'
  readonly emoji = '🔗'
  readonly flow = 'external_link' as const

  get walletAddress(): string {
    return process.env.TON_WALLET_ADDRESS ?? ''
  }

  /** Unique payment memo — identifies payer in blockchain */
  memo(chatId: bigint): string {
    return `TRAILX-${chatId}`
  }

  isAvailable(): boolean {
    return Boolean(this.walletAddress)
  }

  async supportsPlan(planId: PlanId): Promise<boolean> {
    const pricing = await getPricingForProviderSafe(planId, this.id)
    return pricing !== null && pricing.enabled
  }

  async createPaymentLink(planId: PlanId, chatId: bigint): Promise<string> {
    const pricing = await getPricingForProviderSafe(planId, this.id)
    if (!pricing) {
      throw new Error(`No pricing found for plan ${planId} and provider ${this.id}`)
    }

    const params = new URLSearchParams({
      amount: pricing.amount,
      text: this.memo(chatId),
    })
    return `https://app.tonkeeper.com/transfer/${this.walletAddress}?${params.toString()}`
  }

  async formatAmount(planId: PlanId): Promise<string> {
    const pricing = await getPricingForProviderSafe(planId, this.id)
    if (!pricing) {
      throw new Error(`No pricing found for plan ${planId} and provider ${this.id}`)
    }
    return pricing.displayAmount
  }

  async getInstructions(planId: PlanId, chatId: bigint): Promise<string> {
    const amount = await this.formatAmount(planId)
    const memo = this.memo(chatId)
    return (
      `Переведи <b>${amount}</b> на кошелёк:\n` +
      `<code>${this.walletAddress}</code>\n\n` +
      `⚠️ Обязательно укажи комментарий:\n` +
      `<code>${memo}</code>\n\n` +
      `Подписка активируется автоматически в течение ~30 секунд после перевода.`
    )
  }
}
