/**
 * WebPay.by payment provider (Belarusbank acquiring).
 *
 * Flow: POST /woc/order → receive invoiceUrl → send link to user →
 *       user pays on WebPay page → POST webhook to /api/payments/webpay →
 *       activate subscription.
 *
 * Setup (set in .env when you receive credentials from WebPay.by):
 *   WEBPAY_RESOURCE_ID  — merchant ID from WebPay merchant account
 *   WEBPAY_API_KEY      — API key for request signing (HmacSHA512)
 *   WEBPAY_SECRET_KEY   — secret for webhook signature validation (MD5)
 *   WEBPAY_SANDBOX      — "true" to use sandbox (sand-box.webpay.by), default: production
 *
 * Docs: https://docs.webpay.by/en/paymentIntegration/createOrderAPI/
 *
 * --- STUB — not yet active ---
 * isAvailable() returns false until WEBPAY_RESOURCE_ID is set.
 * The implementation below is complete and ready to enable.
 */
import crypto from 'node:crypto'
import type { ExternalLinkProvider } from '../IPaymentProvider'
import type { PlanId } from '../plans'
import { PLANS } from '../plans'

interface WebPayOrderResponse {
  webpayInvoiceId: string
  invoiceUrl: string
}

export class WebPayProvider implements ExternalLinkProvider {
  readonly id = 'webpay'
  readonly name = 'WebPay.by'
  readonly emoji = '💳'
  readonly flow = 'external_link' as const

  private get resourceId(): string { return process.env.WEBPAY_RESOURCE_ID ?? '' }
  private get apiKey(): string { return process.env.WEBPAY_API_KEY ?? '' }
  private get isSandbox(): boolean { return process.env.WEBPAY_SANDBOX === 'true' }

  private get baseUrl(): string {
    return this.isSandbox
      ? 'https://sand-box.webpay.by'
      : 'https://api.webpay.by'
  }

  isAvailable(): boolean {
    return Boolean(this.resourceId && this.apiKey)
  }

  formatAmount(planId: PlanId): string {
    const plan = PLANS[planId]
    return `${plan.amount / 100} ${plan.currency}`
  }

  getInstructions(_planId: PlanId, _chatId: bigint): string {
    return 'Оплати через WebPay.by. После оплаты подписка активируется автоматически.'
  }

  async createPaymentLink(planId: PlanId, chatId: bigint): Promise<string> {
    const plan = PLANS[planId]
    const orderNumber = `TRAILX-${chatId}-${Date.now()}`
    const notifyUrl = process.env.WEBPAY_NOTIFY_URL ?? `${process.env.WEBHOOK_DOMAIN ?? ''}/api/payments/webpay`

    const body = JSON.stringify({
      resourceId: this.resourceId,
      resourceOrderNumber: orderNumber,
      items: [{
        name: `TrailX Pro — ${plan.label}`,
        price: plan.amount / 100,
        quantity: 1,
        currency: plan.currency,
      }],
      urls: {
        returnUrl: `${process.env.VITE_APP_URL ?? 'https://t.me'}/payment/success`,
        cancelUrl: `${process.env.VITE_APP_URL ?? 'https://t.me'}/payment/cancel`,
        notifyUrl,
      },
    })

    const nonce = crypto.randomUUID()
    const signature = this.buildSignature('POST', '/woc/order', body, nonce)

    const res = await fetch(`${this.baseUrl}/woc/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `HmacSHA512 ${this.apiKey}:${nonce}:${signature}`,
      },
      body,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`WebPay order creation failed: ${res.status} ${text}`)
    }

    const data = await res.json() as WebPayOrderResponse
    return data.invoiceUrl
  }

  /**
   * Validates the wsb_signature from a WebPay webhook notification.
   * Call this in the /api/payments/webpay Fastify route.
   *
   * Signature = MD5(batch_timestamp,currency_id,amount,payment_method,
   *                  order_id,site_order_id,transaction_id,payment_type,rrn,SecretKey)
   */
  static validateWebhookSignature(params: Record<string, string>, secretKey: string): boolean {
    const fields = [
      params['batch_timestamp'],
      params['currency_id'],
      params['amount'],
      params['payment_method'],
      params['order_id'],
      params['site_order_id'],
      params['transaction_id'],
      params['payment_type'],
      params['rrn'],
    ]
    // Optional card field
    if (params['card']) fields.push(params['card'])
    fields.push(secretKey)

    const raw = fields.join('')
    const expected = crypto.createHash('md5').update(raw).digest('hex')
    return expected === params['wsb_signature']
  }

  private buildSignature(method: string, path: string, body: string, nonce: string): string {
    const contentType = 'application/json'
    const bodyMd5 = crypto.createHash('md5').update(body).digest('base64')
    const raw = [method, path, contentType, nonce, bodyMd5].join('\n')
    return crypto.createHmac('sha512', this.apiKey).update(raw).digest('hex')
  }
}
