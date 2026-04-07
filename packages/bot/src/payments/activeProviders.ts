/**
 * Active payment providers registry.
 *
 * To add a new provider:
 *   1. Implement IPaymentProvider in providers/<name>.ts
 *   2. Import and add it to ALL_PROVIDERS below
 *
 * Providers where isAvailable() returns false are hidden from the UI.
 */
import type { IPaymentProvider } from './IPaymentProvider'
import { TelegramStarsProvider } from './providers/telegramStars'
import { CryptoPayProvider } from './providers/cryptopay'
import { TonCenterProvider } from './providers/ton'
import { WebPayProvider } from './providers/webpay'

const ALL_PROVIDERS: IPaymentProvider[] = [
  new TelegramStarsProvider(),   // always available
  new CryptoPayProvider(),       // requires CRYPTOPAY_TOKEN
  new TonCenterProvider(),       // requires TON_WALLET_ADDRESS
  new WebPayProvider(),          // requires WEBPAY_RESOURCE_ID + WEBPAY_API_KEY
]

/** Returns providers that are currently configured and ready */
export function getAvailableProviders(): IPaymentProvider[] {
  return ALL_PROVIDERS.filter(p => p.isAvailable())
}

/** Finds a provider by id, regardless of availability */
export function findProvider(id: string): IPaymentProvider | undefined {
  return ALL_PROVIDERS.find(p => p.id === id)
}
