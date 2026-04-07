/**
 * Crypto Pay provider — @CryptoBot / @CryptoTestnetBot (official Telegram product).
 *
 * Flow: createInvoice → user pays via t.me/CryptoBot → webhook → activate subscription.
 * Supports: TON, USDT, BTC, ETH, LTC, BNB, TRX, USDC.
 *
 * Setup:
 *   1. @CryptoBot (prod) or @CryptoTestnetBot (test) → /pay → Create App → copy token
 *   2. Set CRYPTOPAY_TOKEN=... in .env
 *   3. Set CRYPTOPAY_TESTNET=true for testnet
 *   4. Configure webhook in @CryptoBot → /pay → Webhooks → https://<domain>/api/payments/cryptopay
 *
 * Docs: https://help.crypt.bot/crypto-pay-api
 */
import crypto from 'node:crypto'
import type { ExternalLinkProvider } from '../IPaymentProvider'
import type { PlanId } from '../plans'
import { PLANS } from '../plans'

interface CryptoPayInvoiceResponse {
  ok: boolean
  result: {
    invoice_id: number
    status: string
    asset: string
    amount: string
    pay_url: string    // t.me/CryptoBot?start=IV...
    created_at: string
    expires_at: string
  }
}

export class CryptoPayProvider implements ExternalLinkProvider {
  readonly id = 'cryptopay'
  readonly name = 'Crypto Pay'
  readonly emoji = '💎'
  readonly flow = 'external_link' as const

  private get token(): string { return process.env.CRYPTOPAY_TOKEN ?? '' }

  private get baseUrl(): string {
    return process.env.CRYPTOPAY_TESTNET === 'true'
      ? 'https://testnet-pay.crypt.bot/api'
      : 'https://pay.crypt.bot/api'
  }

  isAvailable(): boolean {
    return Boolean(this.token)
  }

  async createPaymentLink(planId: PlanId, chatId: bigint): Promise<string> {
    const plan = PLANS[planId]
    const tonAmount = plan.tonNano === '2000000000' ? '2' : '18'  // TON (not nanotons for CryptoPay)

    const res = await fetch(`${this.baseUrl}/createInvoice`, {
      method: 'POST',
      headers: {
        'Crypto-Pay-API-Token': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        asset: 'TON',
        amount: tonAmount,
        payload: `${chatId}:${planId}`,   // returned as-is in the webhook
        description: plan.description,
        hidden_message: '🎉 Подписка TrailX Pro активирована! Возвращайся в бот.',
        paid_btn_name: 'openBot',
        expires_in: 3600,  // 1 hour
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`CryptoPay createInvoice failed: ${res.status} ${text}`)
    }

    const data = await res.json() as CryptoPayInvoiceResponse
    if (!data.ok) throw new Error(`CryptoPay API error: ${JSON.stringify(data)}`)

    return data.result.pay_url
  }

  formatAmount(planId: PlanId): string {
    return PLANS[planId].tonDisplay
  }

  getInstructions(planId: PlanId, _chatId: bigint): string {
    return (
      `Оплати <b>${PLANS[planId].tonDisplay}</b> через @CryptoBot.\n` +
      `Подписка активируется автоматически после оплаты.`
    )
  }

  /**
   * Validates the HMAC-SHA256 signature from the webhook header.
   * Header name: `crypto-pay-api-signature`
   * Algorithm: HMAC-SHA256(key=SHA256(token), data=JSON.stringify(body))
   */
  static validateSignature(token: string, body: string, signature: string): boolean {
    const secret = crypto.createHash('sha256').update(token).digest()
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
    return expected === signature
  }
}
