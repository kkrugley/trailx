import type { Bot, Context } from 'grammy'
import { registerPlan } from './plan'
import { registerRoute } from './route'
import { registerDelete } from './delete'
import { registerApp } from './app'
import { registerAdd } from './add'
import { registerVote } from './vote'
import { registerGpx } from './gpx'
import { registerWeather } from './weather'
import { registerSocial } from './social'
import { registerUpgrade } from './upgrade'

export function registerCommands(bot: Bot<Context>): void {
  registerPlan(bot)
  registerRoute(bot)
  registerDelete(bot)
  registerApp(bot)
  registerAdd(bot)
  registerVote(bot)
  registerGpx(bot)
  registerWeather(bot)
  registerSocial(bot)
  registerUpgrade(bot)
}
