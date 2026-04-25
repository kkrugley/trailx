/**
 * Crypto Pay webhook — POST /api/payments/cryptopay
 *
 * @CryptoBot calls this URL after a successful payment.
 * Header: crypto-pay-api-signature (HMAC-SHA256)
 * Docs: https://help.crypt.bot/crypto-pay-api#webhooks
 *
 * Configure in @CryptoBot → /pay → Webhooks → set URL to:
 * https://<your-domain>/api/payments/cryptopay
 */
import type { FastifyInstance } from 'fastify'
import type { Bot, Context } from 'grammy'
import { prisma } from '../db'
import { CryptoPayProvider } from '../payments/providers/cryptopay'
import { calcExpiresAt, isPlanId } from '../payments/plans'
import type { PlanId } from '../payments/plans'
import { getPlanSafe } from '../services/pricing'

interface CryptoPayWebhookBody {
  update_type: string
  request_date: string
  payload: {
    invoice_id: number
    status: string
    asset: string
    amount: string
    payload: string // our custom payload: "chatId:planId"
    paid_at?: string
    paid_anonymously?: boolean
  }
}

export function cryptopayRoutes(bot: Bot<Context>) {
  return async function (fastify: FastifyInstance): Promise<void> {
    fastify.post('/api/payments/cryptopay', {
      config: { rawBody: true },
    }, async (req, reply) => {
      const token = process.env.CRYPTOPAY_TOKEN ?? ''

      if (!token) {
        fastify.log.warn('[cryptopay] CRYPTOPAY_TOKEN not set — webhook ignored')
        return reply.code(200).send('OK')
      }

      const signature = (req.headers['crypto-pay-api-signature'] as string | undefined) ?? ''
      // Use rawBody if available (@fastify/raw-body), fall back to JSON.stringify
      const rawBody = (req as unknown as { rawBody?: string }).rawBody
        ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))

      if (!CryptoPayProvider.validateSignature(token, rawBody, signature)) {
        fastify.log.warn({ signature }, '[cryptopay] Invalid webhook signature')
        return reply.code(200).send('OK')
      }

      const update = req.body as CryptoPayWebhookBody

      if (update.update_type !== 'invoice_paid') {
        return reply.code(200).send('OK')
      }

      const invoice = update.payload
      if (invoice.status !== 'paid') {
        return reply.code(200).send('OK')
      }

      // Parse our payload: "chatId:planId"
      const parts = (invoice.payload ?? '').split(':')
      if (parts.length !== 2) {
        fastify.log.warn({ payload: invoice.payload }, '[cryptopay] Unexpected payload format')
        return reply.code(200).send('OK')
      }

      const [chatIdStr, planIdStr] = parts
      const chatId = BigInt(chatIdStr)
      if (!isPlanId(planIdStr)) {
        fastify.log.warn({ planIdStr }, '[cryptopay] Unknown planId in payload')
        return reply.code(200).send('OK')
      }

      const planId = planIdStr as PlanId
      const plan = await getPlanSafe(planId)
      const expiresAt = calcExpiresAt(plan)
      const chargeId = `cryptopay_${invoice.invoice_id}`
      // Store the actual paid amount in nanoTON (integer) for consistency
      const paidAmountInt = Math.round(parseFloat(invoice.amount) * 1e9)

      try {
        await prisma.$transaction([
          prisma.subscription.upsert({
            where: { chatId },
            create: {
              chatId,
              userId: 0n, // userId not available from CryptoPay webhook
              plan: planId,
              status: 'active',
              provider: 'cryptopay',
              amount: paidAmountInt,
              currency: invoice.asset,
              telegramPaymentChargeId: chargeId,
              providerPaymentChargeId: String(invoice.invoice_id),
              expiresAt,
            },
            update: {
              plan: planId,
              status: 'active',
              provider: 'cryptopay',
              amount: paidAmountInt,
              currency: invoice.asset,
              telegramPaymentChargeId: chargeId,
              providerPaymentChargeId: String(invoice.invoice_id),
              expiresAt,
            },
          }),
          prisma.paymentRecord.create({
            data: {
              chatId,
              userId: 0n,
              plan: planId,
              amount: paidAmountInt,
              currency: invoice.asset,
              telegramPaymentChargeId: chargeId,
              providerPaymentChargeId: String(invoice.invoice_id),
              status: 'paid',
            },
          }),
          prisma.group.upsert({
            where: { chatId },
            create: { id: chatId.toString(), chatId, isPro: true },
            update: { isPro: true },
          }),
        ])

        const expiryStr = expiresAt.toLocaleDateString('ru-RU', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        })

        await bot.api.sendMessage(
          Number(chatId),
          `🎉 Подписка <b>TrailX Pro</b> активирована!\n\n` +
          `📦 План: ${plan.label}\n` +
          `💰 Оплачено: ${invoice.amount} ${invoice.asset}\n` +
          `📅 Действует до: <b>${expiryStr}</b>\n\n` +
          `Теперь доступны все групповые функции: /add, /vote, /gpx, /weather.`,
          { parse_mode: 'HTML' },
        )

        fastify.log.info({ chatId: chatId.toString(), planId }, '[cryptopay] Subscription activated')
      } catch (err) {
        fastify.log.error({ err }, '[cryptopay] Failed to activate subscription')
      }

      return reply.code(200).send('OK')
    })
  }
}
