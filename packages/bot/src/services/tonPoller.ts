/**
 * TON Center transaction poller — background job for TonCenterProvider confirmation.
 *
 * Runs every 10 seconds, checks for incoming transactions to the TON wallet,
 * matches them against subscriptions by memo (TRAILX-{chatId}),
 * and activates subscriptions on match.
 *
 * Works in two modes:
 *  - pending_ton: user clicked "Я оплатил" before paying (or after)
 *  - proactive:   user paid without clicking the button — poller still finds it
 *    by matching memo TRAILX-{chatId} against any chat that has no active subscription
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
    message?: string       // decoded text comment (toncenter v2)
    msg_data?: {
      text?: string        // alternative field in some API versions
    }
    value: string          // nanoTON as string
    source?: string        // sender address
  }
}

interface TonCenterResponse {
  ok: boolean
  result: TonTransaction[]
}

/** Set of already-processed tx hashes to avoid double-activation (cleared on restart) */
const processedHashes = new Set<string>()
const MAX_PROCESSED_HASHES = 500

/** Extract memo text from a TON transaction (handles multiple API response formats) */
function extractMemo(tx: TonTransaction): string {
  return (
    tx.in_msg?.message ??
    tx.in_msg?.msg_data?.text ??
    ''
  ).trim()
}

async function pollOnce(bot: Bot<Context>): Promise<void> {
  const address = process.env.TON_WALLET_ADDRESS
  if (!address) return

  // Skip API call if no pending TON payments exist
  const pendingCount = await prisma.subscription.count({
    where: { provider: 'ton', status: 'pending_ton' },
  })
  if (pendingCount === 0) return

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
      console.error(`[tonPoller] API error: ${res.status} ${await res.text()}`)
      return
    }
    data = await res.json() as TonCenterResponse
  } catch (err) {
    console.error('[tonPoller] Network error:', err)
    return
  }

  if (!data.ok || !Array.isArray(data.result)) {
    console.warn('[tonPoller] Unexpected response:', JSON.stringify(data).slice(0, 200))
    return
  }

  // Prevent unbounded growth of in-memory dedup set
  if (processedHashes.size > MAX_PROCESSED_HASHES) {
    processedHashes.clear()
  }

  for (const tx of data.result) {
    const hash = tx.transaction_id?.hash
    if (!hash || processedHashes.has(hash)) continue

    const memo = extractMemo(tx)
    const match = memo.match(/^TRAILX-(-?\d+)$/)

    if (!match) {
      continue
    }

    // Check DB for already-processed tx (survives restarts unlike processedHashes)
    const existing = await prisma.paymentRecord.findUnique({
      where: { telegramPaymentChargeId: `ton_${hash}` },
    })
    if (existing) {
      processedHashes.add(hash)
      continue
    }

    const chatId = BigInt(match[1])
    const valueStr = tx.in_msg?.value ?? '0'
    const valueBigInt = BigInt(valueStr)

    console.log(`[tonPoller] Match! chatId=${chatId}, value=${valueStr} nanoTON, tx=${hash.slice(0, 12)}`)

    // Look up existing subscription
    const sub = await prisma.subscription.findUnique({ where: { chatId } })

    // Skip if already active from this or another provider
    if (sub?.status === 'active') {
      console.log(`[tonPoller] chatId=${chatId} already has active subscription — skipping`)
      processedHashes.add(hash)
      continue
    }

    // Determine plan: use pending sub's plan if available, else check amount
    let planId: PlanId | null = null
    if (sub?.provider === 'ton' && isPlanId(sub.plan)) {
      planId = sub.plan
    } else {
      // Infer plan from amount paid
      const monthly = BigInt(PLANS.monthly.tonNano)
      const annual = BigInt(PLANS.annual.tonNano)
      if (valueBigInt >= annual) planId = 'annual'
      else if (valueBigInt >= monthly) planId = 'monthly'
    }

    if (!planId) {
      console.warn(`[tonPoller] chatId=${chatId}: can't determine plan from amount ${valueStr}`)
      continue
    }

    const plan = PLANS[planId]
    const expectedNano = BigInt(plan.tonNano)

    if (valueBigInt < expectedNano) {
      console.warn(`[tonPoller] Underpayment chatId=${chatId}: got ${valueStr}, need ${plan.tonNano}`)
      continue
    }

    const expiresAt = calcExpiresAt(plan)
    const tonAmount = Number(BigInt(plan.tonNano))  // nanoTON for DB storage
    const expiryStr = expiresAt.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })

    try {
      await prisma.$transaction([
        prisma.subscription.upsert({
          where: { chatId },
          create: {
            chatId,
            userId: sub?.userId ?? 0n,
            plan: planId,
            status: 'active',
            provider: 'ton',
            amount: tonAmount,
            currency: 'TON',
            telegramPaymentChargeId: `ton_${hash}`,
            providerPaymentChargeId: hash,
            expiresAt,
          },
          update: {
            status: 'active',
            plan: planId,
            amount: tonAmount,
            currency: 'TON',
            telegramPaymentChargeId: `ton_${hash}`,
            providerPaymentChargeId: hash,
            expiresAt,
          },
        }),
        prisma.paymentRecord.create({
          data: {
            chatId,
            userId: sub?.userId ?? 0n,
            plan: planId,
            amount: tonAmount,
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
      console.log(`[tonPoller] ✅ Activated chatId=${chatId}, plan=${planId}`)

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
      console.error(`[tonPoller] Failed to activate chatId=${chatId}:`, err)
    }
  }
}

export function startTonPoller(bot: Bot<Context>): void {
  if (!process.env.TON_WALLET_ADDRESS) {
    console.log('[tonPoller] TON_WALLET_ADDRESS not set — disabled')
    return
  }

  const isTestnet = process.env.TONCENTER_TESTNET === 'true'
  console.log(`[tonPoller] Started (${isTestnet ? 'TESTNET' : 'mainnet'}, interval: 30s, polls only when pending_ton exists)`)

  void pollOnce(bot)
  setInterval(() => { void pollOnce(bot) }, POLL_INTERVAL_MS)
}
