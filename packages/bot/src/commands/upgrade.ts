import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { prisma } from '../db'
import {
  getAvailableProviders,
  findProvider,
} from '../payments/activeProviders'
import {
  isTelegramInvoice,
  isExternalLink,
} from '../payments/IPaymentProvider'
import {
  daysRemaining,
  isExpiringSoon,
  type PlanId,
} from '../payments/plans'
import {
  getPlans,
  getPlanSafe,
} from '../services/pricing'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fmtAmount(amount: number, currency: string): string {
  if (currency === 'XTR') return `${amount} ⭐`
  if (currency === 'TON' || currency === 'USDT') return `${amount / 1e9} ${currency}`
  return `${amount / 100} ${currency}`
}

async function getActiveSub(chatId: bigint) {
  const sub = await prisma.subscription.findUnique({ where: { chatId } })
  if (!sub) return null
  if (sub.status === 'active' && sub.expiresAt <= new Date()) {
    await prisma.$transaction([
      prisma.subscription.update({ where: { chatId }, data: { status: 'expired' } }),
      prisma.group.updateMany({ where: { chatId }, data: { isPro: false } }),
    ])
    return { ...sub, status: 'expired' }
  }
  return sub
}

// ── Keyboard builders ─────────────────────────────────────────────────────────

async function planKeyboard(): Promise<InlineKeyboard> {
  const plans = await getPlans()
  const kb = new InlineKeyboard()

  for (const plan of plans) {
    const price = plan.priceDisplay ?? ''
    const prefix = plan.id === 'annual' ? '🔥' : '✅'
    const label = price
      ? `${prefix} ${plan.label} — ${price}`
      : `${prefix} ${plan.label}`
    kb.text(label, `pay:${plan.id}`).row()
  }

  return kb
}

async function providerKeyboard(planId: PlanId): Promise<InlineKeyboard> {
  const providers = getAvailableProviders()
  const kb = new InlineKeyboard()

  for (const p of providers) {
    const supports = await p.supportsPlan?.(planId)
    if (supports === false) continue

    let amount: string
    if (isTelegramInvoice(p)) {
      const currency = await p.getCurrency(planId)
      const amt = await p.getAmount(planId)
      amount = currency === 'XTR'
        ? `${amt} ⭐`
        : `${amt / 100} ${currency}`
    } else {
      amount = await p.formatAmount(planId)
    }

    kb.text(`${p.emoji} ${p.name} — ${amount}`, `method:${p.id}:${planId}`).row()
  }

  kb.text('‹ Назад к планам', 'back:plans')
  return kb
}

function manageKeyboard(sub: NonNullable<Awaited<ReturnType<typeof getActiveSub>>>): InlineKeyboard {
  const kb = new InlineKeyboard()
  if (isExpiringSoon(sub.expiresAt)) {
    kb.text('🔄 Продлить сейчас', `pay:${sub.plan}`).row()
  } else {
    kb.text('🔄 Продлить', `pay:${sub.plan}`).text('⬆️ Сменить план', 'back:plans').row()
  }
  kb.text('📋 История платежей', 'sub:history').row()
  kb.text('❌ Отменить подписку', 'sub:cancel')
  return kb
}

// ── Message builders ──────────────────────────────────────────────────────────

async function statusText(sub: NonNullable<Awaited<ReturnType<typeof getActiveSub>>>): Promise<string> {
  const days = daysRemaining(sub.expiresAt)
  const plan = await getPlanSafe(sub.plan as PlanId)
  const header = isExpiringSoon(sub.expiresAt)
    ? '⚠️ <b>TrailX Pro — истекает скоро!</b>'
    : '✅ <b>TrailX Pro — активна</b>'
  return (
    `${header}\n\n` +
    `📅 До: ${fmt(sub.expiresAt)} (${days} дн.)\n` +
    `📦 План: ${plan.label}\n` +
    `💰 Оплачено: ${fmtAmount(sub.amount, sub.currency)}\n` +
    `🗓 Дата оплаты: ${fmt(sub.createdAt)}`
  )
}

function upgradeText(sub?: Awaited<ReturnType<typeof getActiveSub>>): string {
  let intro = ''
  if (sub?.status === 'cancelled') intro = '🚫 Ваша подписка была отменена.\n\n'
  if (sub?.status === 'expired') intro = `⏰ Ваша подписка истекла ${fmt(sub.expiresAt)}.\n\n`
  if (sub?.status === 'pending_ton') intro = '⏳ Ожидаем подтверждения TON-платежа.\n\n'
  return (
    `${intro}🚀 <b>TrailX Pro</b>\n\n` +
    `Разблокируй полный функционал для группы:\n` +
    `• Добавление точек командой /add\n` +
    `• Голосование за маршрут /vote\n` +
    `• Экспорт GPX /gpx\n` +
    `• Прогноз погоды /weather\n` +
    `• Синхронизация маршрута в реальном времени\n\n` +
    `Один платёж открывает Pro для всей группы.\n\n` +
    `💳 Выбери план:`
  )
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerUpgrade(bot: Bot<Context>): void {
  // ── /upgrade ─────────────────────────────────────────────────────────────
  bot.command('upgrade', async (ctx) => {
    try {
      const chatId = BigInt(ctx.chat?.id ?? 0)
      const sub = await getActiveSub(chatId)
      if (sub?.status === 'active') {
        await ctx.reply(await statusText(sub), {
          parse_mode: 'HTML',
          reply_markup: manageKeyboard(sub),
        })
      } else {
        await ctx.reply(upgradeText(sub ?? undefined), {
          parse_mode: 'HTML',
          reply_markup: await planKeyboard(),
        })
      }
    } catch (err) {
      console.error('[/upgrade]', err)
      await ctx.reply('⚠️ Не удалось загрузить информацию о подписке. Попробуй позже.')
    }
  })

  // ── Plan selected → show payment method selection ─────────────────────────
  bot.callbackQuery(/^pay:(monthly|annual)$/, async (ctx) => {
    await ctx.answerCallbackQuery()
    const planId = ctx.match[1] as PlanId
    const plan = await getPlanSafe(planId)
    const providers = getAvailableProviders()

    if (providers.length === 0) {
      await ctx.reply('⚠️ Платёжные провайдеры не настроены. Обратись к администратору.')
      return
    }

    await ctx.reply(
      `📦 <b>${plan.label}</b> — выбери способ оплаты:`,
      { parse_mode: 'HTML', reply_markup: await providerKeyboard(planId) },
    )
  })

  // ── Back to plan selection ─────────────────────────────────────────────────
  bot.callbackQuery('back:plans', async (ctx) => {
    await ctx.answerCallbackQuery()
    await ctx.reply(upgradeText(), {
      parse_mode: 'HTML',
      reply_markup: await planKeyboard(),
    })
  })

  // ── method:{providerId}:{planId} → process payment ────────────────────────
  bot.callbackQuery(/^method:(\w+):(monthly|annual)$/, async (ctx) => {
    await ctx.answerCallbackQuery()
    const providerId = ctx.match[1]
    const planId = ctx.match[2] as PlanId
    const plan = await getPlanSafe(planId)
    const chatId = BigInt(ctx.chat?.id ?? 0)

    const provider = findProvider(providerId)
    if (!provider || !provider.isAvailable()) {
      await ctx.reply('⚠️ Этот способ оплаты недоступен. Выбери другой.')
      return
    }

    try {
      if (isTelegramInvoice(provider)) {
        const token = provider.getToken()
        const currency = await provider.getCurrency(planId)
        const amount = await provider.getAmount(planId)
        await ctx.replyWithInvoice(
          `TrailX Pro — ${plan.label}`,
          plan.description,
          planId,
          currency,
          [{ label: plan.label, amount }],
          { provider_token: token },
        )
        return
      }

      if (isExternalLink(provider)) {
        const url = await provider.createPaymentLink(planId, chatId)
        const instructions = await provider.getInstructions(planId, chatId)

        const kb = new InlineKeyboard()
          .url(`${provider.emoji} Открыть ${provider.name}`, url)
          .row()
          .text('✅ Я оплатил', `paid:${provider.id}:${planId}`)

        await ctx.reply(
          `${provider.emoji} <b>Оплата через ${provider.name}</b>\n\n` +
          instructions,
          { parse_mode: 'HTML', reply_markup: kb },
        )
      } else {
        const _exhaustive: never = provider
        console.error('[upgrade] Unknown provider flow:', _exhaustive)
      }
    } catch (err) {
      console.error(`[upgrade] method:${providerId} error:`, err)
      await ctx.reply('⚠️ Не удалось создать платёж. Попробуй позже.')
    }
  })

  // ── "Я оплатил" — status check (no admin notification) ─────────────────────
  bot.callbackQuery(/^paid:(\w+):(monthly|annual)$/, async (ctx) => {
    await ctx.answerCallbackQuery()
    const providerId = ctx.match[1]
    const planId = ctx.match[2] as PlanId
    const chatId = BigInt(ctx.chat?.id ?? 0)

    try {
      const existingSub = await getActiveSub(chatId)
      if (existingSub?.status === 'active') {
        await ctx.reply(
          '✅ Подписка уже активна! Используй /upgrade для управления.',
        )
        return
      }

      const kb = new InlineKeyboard()
        .text('🔄 Проверить ещё раз', `paid:${providerId}:${planId}`)
        .row()
        .text('⚠️ У меня проблема с платежом', `payment_issue:${providerId}:${planId}`)

      await ctx.reply(
        '⏳ <b>Платёж пока не подтверждён</b>\n\n' +
        'Система проверяет оплату автоматически — обычно это занимает до минуты.\n' +
        'Нажми «Проверить ещё раз» через пару минут.',
        { parse_mode: 'HTML', reply_markup: kb },
      )
    } catch (err) {
      console.error('[upgrade] paid callback error:', err)
      await ctx.reply('⚠️ Произошла ошибка. Попробуй позже.')
    }
  })

  // ── "У меня проблема с платежом" — escalate to admin ──────────────────────
  bot.callbackQuery(/^payment_issue:(\w+):(monthly|annual)$/, async (ctx) => {
    await ctx.answerCallbackQuery()
    const providerId = ctx.match[1]
    const planId = ctx.match[2] as PlanId
    const chatId = BigInt(ctx.chat?.id ?? 0)
    const userId = BigInt(ctx.from?.id ?? 0)
    const plan = await getPlanSafe(planId)

    try {
      const existingSub = await getActiveSub(chatId)
      if (existingSub?.status === 'active') {
        await ctx.reply(
          '✅ Подписка уже активна! Используй /upgrade для управления.',
        )
        return
      }

      const adminChatId = process.env.ADMIN_CHAT_ID
      if (adminChatId) {
        const username = ctx.from?.username ? `@${ctx.from.username}` : `id:${userId}`
        const provider = findProvider(providerId)
        const providerName = provider?.name ?? providerId

        const contextLines = [
          `⚠️ <b>Проблема с платежом</b>\n`,
          `Пользователь: ${username}`,
          `Chat: <code>${chatId}</code>`,
          `Провайдер: ${providerName}`,
          `План: ${plan.label}`,
        ]
        if (providerId === 'ton') {
          contextLines.push(`Memo: <code>TRAILX-${chatId}</code>`)
          contextLines.push(`Кошелёк: <code>${process.env.TON_WALLET_ADDRESS ?? '?'}</code>`)
        }
        if (providerId === 'cryptopay') {
          contextLines.push(`Payload: <code>${chatId}:${planId}</code>`)
        }
        contextLines.push(`\nВремя жалобы: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Minsk' })}`)

        const confirmKb = new InlineKeyboard()
          .text('✅ Подтвердить', `admin:confirm:${chatId}:${planId}`)
          .text('❌ Отклонить', `admin:reject:${chatId}`)

        await ctx.api.sendMessage(
          adminChatId,
          contextLines.join('\n'),
          { parse_mode: 'HTML', reply_markup: confirmKb },
        )
      }

      await ctx.reply(
        '📨 <b>Заявка отправлена</b>\n\n' +
        'Мы проверим платёж вручную и активируем подписку.\n' +
        'Обычно это занимает до 24 часов.',
        { parse_mode: 'HTML' },
      )
    } catch (err) {
      console.error('[upgrade] payment_issue callback error:', err)
      await ctx.reply('⚠️ Не удалось отправить заявку. Попробуй позже.')
    }
  })

  // ── Admin: confirm TON payment ────────────────────────────────────────────
  bot.callbackQuery(/^admin:confirm:(-?\d+):(monthly|annual)$/, async (ctx) => {
    await ctx.answerCallbackQuery()
    const chatId = BigInt(ctx.match[1])
    const planId = ctx.match[2] as PlanId
    const plan = await getPlanSafe(planId)

    try {
      const existingSub = await getActiveSub(chatId)
      if (existingSub?.status === 'active') {
        await ctx.editMessageText(`ℹ️ Подписка для chat ${chatId} уже активна — ручное подтверждение не требуется.`)
        return
      }

      const now = new Date()
      const expiresAt = new Date(now.getTime() + plan.days * 24 * 60 * 60 * 1000)

      await prisma.$transaction([
        prisma.subscription.update({
          where: { chatId },
          data: { status: 'active', expiresAt },
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

      await ctx.api.sendMessage(
        Number(chatId),
        `🎉 Подписка <b>TrailX Pro</b> активирована!\n\n` +
        `📦 План: ${plan.label}\n` +
        `📅 Действует до: <b>${expiryStr}</b>\n\n` +
        `Теперь доступны все групповые функции: /add, /vote, /gpx, /weather.`,
        { parse_mode: 'HTML' },
      )

      await ctx.editMessageText(`✅ Подписка для chat ${chatId} активирована до ${expiryStr}.`)
    } catch (err) {
      console.error('[admin:confirm] error:', err)
      await ctx.reply('⚠️ Ошибка активации.')
    }
  })

  // ── Admin: reject TON payment ─────────────────────────────────────────────
  bot.callbackQuery(/^admin:reject:(-?\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery()
    const chatId = BigInt(ctx.match[1])

    try {
      const result = await prisma.subscription.updateMany({
        where: { chatId, status: 'pending_ton' },
        data: { status: 'cancelled' },
      })

      if (result.count > 0) {
        await ctx.api.sendMessage(
          Number(chatId),
          '❌ К сожалению, ваш платёж не прошёл проверку.\n' +
          'Если вы считаете это ошибкой — напишите нам напрямую.',
        )
        await ctx.editMessageText(`❌ Платёж для chat ${chatId} отклонён.`)
      } else {
        await ctx.editMessageText(`ℹ️ Подписка для chat ${chatId} уже активна или отсутствует — отклонение не применено.`)
      }
    } catch (err) {
      console.error('[admin:reject] error:', err)
    }
  })

  // ── History ───────────────────────────────────────────────────────────────
  bot.callbackQuery('sub:history', async (ctx) => {
    await ctx.answerCallbackQuery()
    const chatId = BigInt(ctx.chat?.id ?? 0)

    try {
      const records = await prisma.paymentRecord.findMany({
        where: { chatId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })

      if (records.length === 0) {
        await ctx.reply('📋 История платежей пуста.')
        return
      }

      const lines = await Promise.all(records.map(async (r, i) => {
        const plan = await getPlanSafe(r.plan as PlanId)
        const label = plan?.label ?? r.plan
        const date = fmt(r.createdAt)
        const amount = fmtAmount(r.amount, r.currency)
        return `${i + 1}. ${date} — ${label} — ${amount}`
      }))

      await ctx.reply(
        `📋 <b>История платежей</b>:\n\n` + lines.join('\n'),
        { parse_mode: 'HTML' },
      )
    } catch (err) {
      console.error('[upgrade] history error:', err)
      await ctx.reply('⚠️ Не удалось загрузить историю платежей.')
    }
  })

  // ── Cancel ────────────────────────────────────────────────────────────────
  bot.callbackQuery('sub:cancel', async (ctx) => {
    await ctx.answerCallbackQuery()
    await ctx.reply(
      '❓ Вы уверены, что хотите отменить подписку TrailX Pro?\n\n' +
      'Доступ к Pro-функциям будет закрыт немедленно.',
      {
        reply_markup: new InlineKeyboard()
          .text('✅ Да, отменить', 'sub:cancel_confirm')
          .text('❌ Нет, оставить', 'sub:cancel_abort'),
      },
    )
  })

  bot.callbackQuery('sub:cancel_confirm', async (ctx) => {
    await ctx.answerCallbackQuery()
    const chatId = BigInt(ctx.chat?.id ?? 0)

    try {
      await prisma.$transaction([
        prisma.subscription.updateMany({
          where: { chatId, status: 'active' },
          data: { status: 'cancelled' },
        }),
        prisma.group.updateMany({ where: { chatId }, data: { isPro: false } }),
      ])

      await ctx.reply(
        '🚫 Подписка TrailX Pro отменена.\n\n' +
        'Ты всегда можешь возобновить подписку с /upgrade.',
      )
    } catch (err) {
      console.error('[upgrade] cancel error:', err)
      await ctx.reply('⚠️ Не удалось отменить подписку. Попробуй позже.')
    }
  })

  bot.callbackQuery('sub:cancel_abort', async (ctx) => {
    await ctx.answerCallbackQuery('Подписка сохранена 👍')
    await ctx.reply('👍 Подписка сохранена.')
  })

  // ── Subscription transfer: confirm in group context ───────────────────────
  bot.callbackQuery(/^confirm_transfer:(\d+):(monthly|annual)$/, async (ctx) => {
    await ctx.answerCallbackQuery()
    const userId = BigInt(ctx.match[1])
    const planId = ctx.match[2] as PlanId
    const groupChatId = BigInt(ctx.chat?.id ?? 0)
    const confirmerId = BigInt(ctx.from?.id ?? 0)

    // Only the buyer can confirm
    if (confirmerId !== userId) {
      await ctx.answerCallbackQuery('⚠️ Только покупатель может активировать подписку.')
      return
    }

    try {
      // Find subscription bought in a private chat (chatId == userId)
      const sub = await prisma.subscription.findFirst({
        where: { userId, chatId: userId, status: 'active' },
      })
      if (!sub) {
        await ctx.reply('⚠️ Активная личная подписка не найдена.')
        return
      }

      const existing = await getActiveSub(groupChatId)
      if (existing?.status === 'active') {
        await ctx.reply('ℹ️ У этой группы уже есть активная подписка.')
        return
      }

      await prisma.$transaction([
        // Move subscription chatId to the group
        prisma.subscription.update({ where: { id: sub.id }, data: { chatId: groupChatId } }),
        // Remove isPro from the old private "group" record
        prisma.group.updateMany({ where: { chatId: userId }, data: { isPro: false } }),
        // Activate Pro for the target group
        prisma.group.upsert({
          where: { chatId: groupChatId },
          create: { id: groupChatId.toString(), chatId: groupChatId, isPro: true },
          update: { isPro: true },
        }),
      ])

      const plan = await getPlanSafe(planId)
      const expiryStr = sub.expiresAt.toLocaleDateString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })

      await ctx.reply(
        `🎉 <b>TrailX Pro</b> активирован для этой группы!\n\n` +
        `📦 План: ${plan.label}\n` +
        `📅 Действует до: <b>${expiryStr}</b>\n\n` +
        `Доступны: /add, /vote, /gpx, /weather.`,
        { parse_mode: 'HTML' },
      )
    } catch (err) {
      console.error('[confirm_transfer]', err)
      await ctx.reply('⚠️ Ошибка при передаче подписки. Попробуй позже.')
    }
  })
}
