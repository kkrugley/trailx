/**
 * WebPay.by payment provider (Belarusbank acquiring).
 *
 * Flow: POST /woc/order → receive invoiceUrl → send link to user →
 * user pays on WebPay page → POST webhook to /api/payments/webpay →
 * activate subscription.
 *
 * Setup (set in .env when you receive credentials from WebPay.by):
 * WEBPAY_RESOURCE_ID — merchant ID from WebPay merchant account
 * WEBPAY_API_KEY — API key for request signing (HmacSHA512)
 * WEBPAY_SECRET_KEY — secret for webhook signature validation (MD5)
 * WEBPAY_SANDBOX — "true" to use sandbox (sand-box.webpay.by), default: production
 *
 * Docs: https://docs.webpay.by/en/paymentIntegration/createOrderAPI/
 *
 * Note: Prices are in USD cents. The actual currency shown to user depends on
 * WebPay configuration, but we store and track amounts in USD.
 */
import crypto from 'node:crypto'
import type { ExternalLinkProvider } from '../IPaymentProvider'
import type { PlanId } from '../plans'
import { getPricingForProviderSafe, getPlanSafe } from '../../services/pricing'

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

  async supportsPlan(planId: PlanId): Promise<boolean> {
    const pricing = await getPricingForProviderSafe(planId, this.id)
    return pricing !== null && pricing.enabled
  }

  async formatAmount(planId: PlanId): Promise<string> {
    const pricing = await getPricingForProviderSafe(planId, this.id)
    if (!pricing) {
      throw new Error(`No pricing found for plan ${planId} and provider ${this.id}`)
    }
    return pricing.displayAmount
  }

  async getInstructions(_planId: PlanId, _chatId: bigint): Promise<string> {
    return 'Оплати через WebPay.by. После оплаты подписка активируется автоматически.'
  }

  async createPaymentLink(planId: PlanId, chatId: bigint): Promise<string> {
    const plan = await getPlanSafe(planId)
    const pricing = await getPricingForProviderSafe(planId, this.id)
    if (!pricing) {
      throw new Error(`No pricing found for plan ${planId} and provider ${this.id}`)
    }

    // USD cents → dollars for WebPay API
    const amountCents = parseInt(pricing.amount, 10)
    const amountDollars = amountCents / 100

    const orderNumber = `TRAILX-${chatId}-${Date.now()}`
    const notifyUrl = process.env.WEBPAY_NOTIFY_URL ?? `${process.env.WEBHOOK_DOMAIN ?? ''}/api/payments/webpay`

    const body = JSON.stringify({
      resourceId: this.resourceId,
      resourceOrderNumber: orderNumber,
      items: [{
        name: `TrailX Pro — ${plan.label}`,
        price: amountDollars,
        quantity: 1,
        currency: pricing.currency, // 'USD'
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
   * order_id,site_order_id,transaction_id,payment_type,rrn,SecretKey)
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
    const actual = params['wsb_signature'] ?? ''
    if (expected.length !== actual.length) return false
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))
  }

  private buildSignature(method: string, path: string, body: string, nonce: string): string {
    const contentType = 'application/json'
    const bodyMd5 = crypto.createHash('md5').update(body).digest('base64')
    const raw = [method, path, contentType, nonce, bodyMd5].join('\n')
    return crypto.createHmac('sha512', this.apiKey).update(raw).digest('hex')
  }
}
