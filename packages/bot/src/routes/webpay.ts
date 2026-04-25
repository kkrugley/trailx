/**
 * WebPay.by payment webhook — POST /api/payments/webpay
 *
 * WebPay calls this URL after a successful payment (wsb_notify_url).
 * We validate the MD5 signature and activate the subscription.
 *
 * Source IP to whitelist: 178.163.225.84
 * Docs: https://docs.webpay.by/en/paymentIntegration/cardIntegration/paymentNotification/
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { WebPayProvider } from '../payments/providers/webpay'
import { calcExpiresAt, isPlanId } from '../payments/plans'
import { getPlanSafe, getPricingForProviderSafe } from '../services/pricing'

export async function webpayRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/payments/webpay', async (req, reply) => {
    const secretKey = process.env.WEBPAY_SECRET_KEY ?? ''

    if (!secretKey) {
      fastify.log.warn('[webpay] WEBPAY_SECRET_KEY not set — webhook ignored')
      return reply.code(200).send('OK') // Return 200 to stop WebPay retrying
    }

    const params = req.body as Record<string, string>

    // Validate signature
    if (!WebPayProvider.validateWebhookSignature(params, secretKey)) {
      fastify.log.warn({ params }, '[webpay] Invalid webhook signature')
      return reply.code(200).send('OK') // Still return 200 to stop retries
    }

    // payment_type=1 or 4 means successful payment
    const paymentType = Number(params['payment_type'])
    if (paymentType !== 1 && paymentType !== 4) {
      return reply.code(200).send('OK')
    }

    // Parse order number: "TRAILX-{chatId}-{timestamp}"
    const orderNumber = params['site_order_id'] ?? ''
    const match = orderNumber.match(/^TRAILX-(-?\d+)-\d+$/)
    if (!match) {
      fastify.log.warn({ orderNumber }, '[webpay] Unrecognised order number')
      return reply.code(200).send('OK')
    }

    const chatId = BigInt(match[1])

    // Determine plan from payment amount
    // WebPay sends decimal USD, we compare with expected amounts from DB
    const paidAmountCents = Math.round(Number(params['amount']) * 100)
    let planId: string | null = null

    // Check which plan's pricing matches the paid amount
    for (const pid of ['monthly', 'annual'] as const) {
      const pricing = await getPricingForProviderSafe(pid, 'webpay')
      if (pricing && pricing.enabled) {
        const expectedAmount = parseInt(pricing.amount, 10)
        if (Math.abs(paidAmountCents - expectedAmount) < 10) { // Allow 10 cent tolerance
          planId = pid
          break
        }
      }
    }

    if (!planId || !isPlanId(planId)) {
      fastify.log.warn({ amount: params['amount'] }, '[webpay] Cannot determine planId from amount')
      return reply.code(200).send('OK')
    }

    const plan = await getPlanSafe(planId)
    const expiresAt = calcExpiresAt(plan)
    const transactionId = params['transaction_id'] ?? ''

    try {
      await prisma.$transaction([
        prisma.subscription.upsert({
          where: { chatId },
          create: {
            chatId,
            userId: 0n, // userId not available from WebPay webhook
            plan: planId,
            status: 'active',
            provider: 'webpay',
            amount: paidAmountCents,
            currency: params['currency_id'] ?? 'USD',
            telegramPaymentChargeId: `webpay_${transactionId}`,
            providerPaymentChargeId: transactionId,
            expiresAt,
          },
          update: {
            plan: planId,
            status: 'active',
            provider: 'webpay',
            amount: paidAmountCents,
            expiresAt,
          },
        }),
        prisma.paymentRecord.create({
          data: {
            chatId,
            userId: 0n,
            plan: planId,
            amount: paidAmountCents,
            currency: params['currency_id'] ?? 'USD',
            telegramPaymentChargeId: `webpay_${transactionId}`,
            providerPaymentChargeId: transactionId,
            status: 'paid',
          },
        }),
        prisma.group.upsert({
          where: { chatId },
          create: { id: chatId.toString(), chatId, isPro: true },
          update: { isPro: true },
        }),
      ])

      fastify.log.info(`[webpay] Subscription activated for chatId=${chatId}, plan=${planId}`)
    } catch (err) {
      fastify.log.error({ err }, '[webpay] Failed to activate subscription')
      // Still return 200 — we've logged the issue, don't want WebPay to keep retrying
    }

    return reply.code(200).send('OK')
  })
}
