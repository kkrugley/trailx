import type { Bot, Context } from 'grammy'
import { registerPaymentHandlers } from '../payments'
import { registerStart } from './start'
import { registerPlan } from './plan'
import { registerMyRoutes } from './myroutes'
import { registerEdit } from './edit'
import { registerApp } from './app'
import { registerAdd } from './add'
import { registerVote } from './vote'
import { registerGpx } from './gpx'
import { registerWeather } from './weather'
import { registerSocial } from './social'
import { registerUpgrade } from './upgrade'
import { registerHelp } from './help'
import { registerInlineQuery } from './inlineQuery'
import { registerChatMember } from './chatMember'

export function registerCommands(bot: Bot<Context>): void {
  registerStart(bot)
  registerPlan(bot)
  registerMyRoutes(bot)
  registerEdit(bot)
  registerApp(bot)
  registerAdd(bot)
  registerVote(bot)
  registerGpx(bot)
  registerWeather(bot)
  registerSocial(bot)
  registerUpgrade(bot)
  registerPaymentHandlers(bot)
  registerHelp(bot)
  registerInlineQuery(bot)
  registerChatMember(bot)
}
