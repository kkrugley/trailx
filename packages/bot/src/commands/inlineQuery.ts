import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { getPlanSafe } from '../services/pricing'
import type { PlanId } from '../payments/plans'

export function registerInlineQuery(bot: Bot<Context>): void {
  bot.on('inline_query', async (ctx) => {
    try {
      const query = ctx.inlineQuery.query.trim()

      // Subscription transfer: query = "transfer:{userId}:{planId}"
      const transferMatch = query.match(/^transfer:(\d+):(monthly|annual)$/)
      if (transferMatch) {
        const [, userId, planId] = transferMatch
        const plan = await getPlanSafe(planId as PlanId)
        const priceHint = plan.priceDisplay ? ` — ${plan.priceDisplay}` : ''

        const confirmKb = new InlineKeyboard()
          .text('✅ Подтвердить активацию', `confirm_transfer:${userId}:${planId}`)

        await ctx.answerInlineQuery(
          [
            {
              type: 'article' as const,
              id: 'activate',
              title: '✅ Активировать TrailX Pro для этой группы',
              description: `План: ${plan.label}${priceHint}`,
              input_message_content: {
                message_text:
                  `🎉 <b>TrailX Pro</b> — запрос на активацию!\n` +
                  `📦 План: ${plan.label}${priceHint}\n\n` +
                  `Нажми кнопку ниже для подтверждения.`,
                parse_mode: 'HTML' as const,
              },
              reply_markup: confirmKb,
            },
          ],
          { cache_time: 0 },
        )
        return
      }

      await ctx.answerInlineQuery([], { cache_time: 60 })
    } catch (err) {
      console.error('[inline_query]', err)
      await ctx.answerInlineQuery([], { cache_time: 0 })
    }
  })
}
