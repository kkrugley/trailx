import type { Bot, Context } from 'grammy'
import { prisma } from '../db'
import { PLANS, calcExpiresAt, isPlanId } from './plans'

/**
 * Registers Telegram Payments lifecycle handlers — covers both:
 *  - Telegram Stars (currency='XTR')
 *  - Any fiat provider using Telegram's invoice flow (WebPay via Telegram Payments, etc.)
 *
 *  pre_checkout_query  — must respond within 10 seconds
 *  message:successful_payment — activate/renew subscription in DB
 */
export function registerPaymentHandlers(bot: Bot<Context>): void {
  // ── Pre-checkout validation ──────────────────────────────────────────────
  bot.on('pre_checkout_query', async (ctx) => {
    const payload = ctx.preCheckoutQuery.invoice_payload

    if (!isPlanId(payload)) {
      await ctx.answerPreCheckoutQuery(false, 'Неизвестный план подписки. Попробуй снова.')
      return
    }

    await ctx.answerPreCheckoutQuery(true)
  })

  // ── Successful payment — activate subscription ───────────────────────────
  bot.on('message:successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment
    if (!payment) return

    const planId = payment.invoice_payload
    if (!isPlanId(planId)) {
      console.error('[payment] Unknown planId in successful_payment payload:', planId)
      return
    }

    const chatId = BigInt(ctx.chat.id)
    const userId = BigInt(ctx.from.id)
    const plan = PLANS[planId]
    const now = new Date()
    const expiresAt = calcExpiresAt(plan, now)

    // Detect provider from currency
    const currency = payment.currency  // 'XTR' for Stars, 'BYN' for fiat
    const providerId = currency === 'XTR' ? 'stars' : 'webpay'
    const amount = payment.total_amount  // Stars or kopecks depending on currency

    const telegramPaymentChargeId = payment.telegram_payment_charge_id
    const providerPaymentChargeId = payment.provider_payment_charge_id ?? null

    try {
      await prisma.$transaction([
        prisma.subscription.upsert({
          where: { chatId },
          create: {
            chatId,
            userId,
            plan: planId,
            status: 'active',
            provider: providerId,
            amount,
            currency,
            telegramPaymentChargeId,
            providerPaymentChargeId,
            expiresAt,
          },
          update: {
            userId,
            plan: planId,
            status: 'active',
            provider: providerId,
            amount,
            currency,
            telegramPaymentChargeId,
            providerPaymentChargeId,
            expiresAt,
          },
        }),
        prisma.paymentRecord.create({
          data: {
            chatId,
            userId,
            plan: planId,
            amount,
            currency,
            telegramPaymentChargeId,
            providerPaymentChargeId,
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

      const amountStr = currency === 'XTR'
        ? `${amount} ⭐`
        : `${amount / 100} ${currency}`

      await ctx.reply(
        `🎉 Подписка <b>TrailX Pro</b> активирована!\n\n` +
        `📦 План: ${plan.label}\n` +
        `💰 Оплачено: ${amountStr}\n` +
        `📅 Действует до: <b>${expiryStr}</b>\n\n` +
        `Теперь доступны все групповые функции: /add, /vote, /gpx, /weather.`,
        { parse_mode: 'HTML' },
      )
    } catch (err) {
      console.error('[payment] Failed to activate subscription:', err)
      await ctx.reply(
        '⚠️ Платёж прошёл, но произошла ошибка активации подписки. ' +
        'Обратись в поддержку с кодом: ' + telegramPaymentChargeId,
      )
    }
  })
}
