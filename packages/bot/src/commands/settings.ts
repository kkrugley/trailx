import type { Bot, Context } from 'grammy'
import { InlineKeyboard } from 'grammy'
import { getUserSettings, updateUserSettings, type Language, type RouteProfile } from '../services/userSettings'
import { t } from '../i18n/messages'

const PROFILE_LABELS: Record<RouteProfile, { ru: string; en: string }> = {
  bike:        { ru: 'Велосипед', en: 'Bicycle' },
  racingbike:  { ru: 'Шоссе', en: 'Road bike' },
  mtb:         { ru: 'Горный', en: 'MTB' },
  foot:        { ru: 'Пешком', en: 'Foot' },
}

const LANG_LABELS: Record<Language, string> = {
  ru: '🇷🇺 Русский',
  en: '🇬🇧 English',
}

function profileLabel(profile: RouteProfile, lang: Language): string {
  const labels = PROFILE_LABELS[profile]
  return `${labels[lang]} (${profile})`
}

function mainKeyboard(lang: Language): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(lang, 'settingsBtnLang'), 'settings_lang').row()
    .text(t(lang, 'settingsBtnProfile'), 'settings_profile')
}

function langKeyboard(current: Language): InlineKeyboard {
  const kb = new InlineKeyboard()
  const langs: Language[] = ['ru', 'en']
  for (const l of langs) {
    const mark = l === current ? '✓ ' : ''
    kb.text(`${mark}${LANG_LABELS[l]}`, `set_lang:${l}`).row()
  }
  return kb.text('« Назад / Back', 'settings_back')
}

function profileKeyboard(current: RouteProfile, lang: Language): InlineKeyboard {
  const kb = new InlineKeyboard()
  const profiles: RouteProfile[] = ['bike', 'racingbike', 'mtb', 'foot']
  for (const p of profiles) {
    const mark = p === current ? '✓ ' : ''
    kb.text(`${mark}${profileLabel(p, lang)}`, `set_profile:${p}`).row()
  }
  return kb.text(lang === 'ru' ? '« Назад' : '« Back', 'settings_back')
}

function mainText(lang: Language, profile: RouteProfile): string {
  return (
    `${t(lang, 'settingsTitle')}\n\n` +
    `${t(lang, 'settingsLangLabel')}: ${LANG_LABELS[lang]}\n` +
    `${t(lang, 'settingsProfileLabel')}: ${profileLabel(profile, lang)}`
  )
}

export function registerSettings(bot: Bot<Context>): void {
  bot.command('settings', async (ctx) => {
    const telegramId = BigInt(ctx.from?.id ?? ctx.chat.id)
    const settings = await getUserSettings(telegramId)
    await ctx.reply(mainText(settings.language, settings.routeProfile), {
      reply_markup: mainKeyboard(settings.language),
    })
  })

  bot.callbackQuery('settings_lang', async (ctx) => {
    await ctx.answerCallbackQuery()
    const telegramId = BigInt(ctx.from.id)
    const settings = await getUserSettings(telegramId)
    await ctx.editMessageText(t(settings.language, 'settingsLangMenu'), {
      reply_markup: langKeyboard(settings.language),
    })
  })

  bot.callbackQuery('settings_profile', async (ctx) => {
    await ctx.answerCallbackQuery()
    const telegramId = BigInt(ctx.from.id)
    const settings = await getUserSettings(telegramId)
    await ctx.editMessageText(t(settings.language, 'settingsProfileMenu'), {
      reply_markup: profileKeyboard(settings.routeProfile, settings.language),
    })
  })

  bot.callbackQuery('settings_back', async (ctx) => {
    await ctx.answerCallbackQuery()
    const telegramId = BigInt(ctx.from.id)
    const settings = await getUserSettings(telegramId)
    await ctx.editMessageText(mainText(settings.language, settings.routeProfile), {
      reply_markup: mainKeyboard(settings.language),
    })
  })

  bot.callbackQuery(/^set_lang:/, async (ctx) => {
    await ctx.answerCallbackQuery()
    const lang = ctx.callbackQuery.data.slice('set_lang:'.length) as Language
    const telegramId = BigInt(ctx.from.id)
    const settings = await updateUserSettings(telegramId, { language: lang })
    await ctx.editMessageText(mainText(settings.language, settings.routeProfile), {
      reply_markup: mainKeyboard(settings.language),
    })
  })

  bot.callbackQuery(/^set_profile:/, async (ctx) => {
    await ctx.answerCallbackQuery()
    const profile = ctx.callbackQuery.data.slice('set_profile:'.length) as RouteProfile
    const telegramId = BigInt(ctx.from.id)
    const settings = await updateUserSettings(telegramId, { routeProfile: profile })
    await ctx.editMessageText(mainText(settings.language, settings.routeProfile), {
      reply_markup: mainKeyboard(settings.language),
    })
  })
}
