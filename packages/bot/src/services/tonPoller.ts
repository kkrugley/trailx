/**
 * TON Center transaction poller — background job for TonCenterProvider confirmation.
 *
 * Runs every 30 seconds, checks for incoming transactions to the TON wallet,
 * matches them against pending subscriptions by memo (TRAILX-{chatId}),
 * and activates subscriptions on match.
 */
import type { Bot, Context } from 'grammy'
import { prisma } from '../db'
import { PLANS, calcExpiresAt, isPlanId } from '../payments/plans'
import type { PlanId } from '../payments/plans'

const POLL_INTERVAL_MS = 30_000
const TX_LIMIT = 20

interface TonTransaction {
  transaction_id: { hash: string; lt: string }
  in_msg: {
    message: string  // the comment/memo
    value: string    // nanoTON as string
  }
}

interface TonCenterResponse {
  ok: boolean
  result: TonTransaction[]
}

/** Set of already-processed tx hashes to avoid double-activation (cleared on restart) */
const processedHashes = new Set<string>()

async function pollOnce(bot: Bot<Context>): Promise<void> {
  const address = process.env.TON_WALLET_ADDRESS
  if (!address) return  // Provider not configured

  const apiKey = process.env.TONCENTER_API_KEY ?? ''
  const isTestnet = process.env.TONCENTER_TESTNET === 'true'
  const baseUrl = isTestnet ? 'https://testnet.toncenter.com' : 'https://toncenter.com'
  const url = new URL(`${baseUrl}/api/v2/getTransactions`)
  url.searchParams.set('address', address)
  url.searchParams.set('limit', String(TX_LIMIT))
  if (apiKey) url.searchParams.set('api_key', apiKey)

  let data: TonCenterResponse
  try {
    const res = await fetch(url.toString())
    if (!res.ok) {
      console.error(`[tonPoller] API error: ${res.status}`)
      return
    }
    data = await res.json() as TonCenterResponse
  } catch (err) {
    console.error('[tonPoller] Network error:', err)
    return
  }

  if (!data.ok || !Array.isArray(data.result)) return

  for (const tx of data.result) {
    const hash = tx.transaction_id?.hash
    if (!hash || processedHashes.has(hash)) continue

    const memo = tx.in_msg?.message ?? ''
    const match = memo.match(/^TRAILX-(-?\d+)$/)
    if (!match) continue

    const chatId = BigInt(match[1])
    const valueBigInt = BigInt(tx.in_msg?.value ?? '0')

    // Find pending subscription for this chatId
    const sub = await prisma.subscription.findUnique({ where: { chatId } })
    if (!sub || sub.status !== 'pending_ton' || sub.provider !== 'ton') continue

    const planId = sub.plan as PlanId
    if (!isPlanId(planId)) continue

    const plan = PLANS[planId]
    const expectedNano = BigInt(plan.tonNano)

    if (valueBigInt < expectedNano) {
      console.warn(`[tonPoller] Underpayment for chatId=${chatId}: got ${valueBigInt}, expected ${expectedNano}`)
      continue
    }

    // Activate subscription
    const expiresAt = calcExpiresAt(plan)
    const expiryStr = expiresAt.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })

    try {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { chatId },
          data: {
            status: 'active',
            amount: plan.amount,
            currency: 'TON',
            telegramPaymentChargeId: `ton_${hash}`,
            providerPaymentChargeId: hash,
            expiresAt,
          },
        }),
        prisma.paymentRecord.create({
          data: {
            chatId,
            userId: sub.userId,
            plan: planId,
            amount: plan.amount,
            currency: 'TON',
            telegramPaymentChargeId: `ton_${hash}`,
            providerPaymentChargeId: hash,
            status: 'paid',
          },
        }),
        prisma.group.upsert({
          where: { chatId },
          create: { id: chatId.toString(), chatId, isPro: true },
          update: { isPro: true },
        }),
      ])

      processedHashes.add(hash)

      console.log(`[tonPoller] Subscription activated for chatId=${chatId}, plan=${planId}, tx=${hash}`)

      await bot.api.sendMessage(
        Number(chatId),
        `🎉 Подписка <b>TrailX Pro</b> активирована!\n\n` +
        `📦 План: ${plan.label}\n` +
        `💰 Оплачено: ${plan.tonDisplay}\n` +
        `📅 Действует до: <b>${expiryStr}</b>\n\n` +
        `Теперь доступны все групповые функции: /add, /vote, /gpx, /weather.`,
        { parse_mode: 'HTML' },
      )
    } catch (err) {
      console.error(`[tonPoller] Failed to activate subscription for chatId=${chatId}:`, err)
    }
  }
}

export function startTonPoller(bot: Bot<Context>): void {
  if (!process.env.TON_WALLET_ADDRESS) {
    console.log('[tonPoller] TON_WALLET_ADDRESS not set — TON direct polling disabled')
    return
  }

  console.log('[tonPoller] Started (interval: 30s)')

  // Initial poll
  void pollOnce(bot)

  setInterval(() => { void pollOnce(bot) }, POLL_INTERVAL_MS)
}
