import { describe, it, expect, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { PLANS, calcExpiresAt, daysRemaining, isExpiringSoon, isPlanId } from './plans'
import { BePaidProvider } from './providers/bepaid'
import { TelegramStarsProvider } from './providers/telegramStars'
import { TonCenterProvider } from './providers/ton'
import { CryptoPayProvider } from './providers/cryptopay'

describe('PLANS', () => {
  it('monthly has correct BYN amount (500 kopecks = 5 BYN)', () => {
    expect(PLANS.monthly.amount).toBe(500)
    expect(PLANS.monthly.currency).toBe('BYN')
    expect(PLANS.monthly.days).toBe(30)
  })

  it('annual has correct BYN amount (4500 kopecks = 45 BYN)', () => {
    expect(PLANS.annual.amount).toBe(4500)
    expect(PLANS.annual.currency).toBe('BYN')
    expect(PLANS.annual.days).toBe(365)
  })

  it('monthly has correct Stars amount', () => {
    expect(PLANS.monthly.starsAmount).toBe(99)
  })

  it('annual has correct Stars amount', () => {
    expect(PLANS.annual.starsAmount).toBe(899)
  })

  it('monthly has correct TON nanoton amount (2 TON)', () => {
    expect(PLANS.monthly.tonNano).toBe('2000000000')
    expect(PLANS.monthly.tonDisplay).toBe('2 TON')
  })

  it('annual has correct TON nanoton amount (18 TON)', () => {
    expect(PLANS.annual.tonNano).toBe('18000000000')
    expect(PLANS.annual.tonDisplay).toBe('18 TON')
  })

  it('annual is cheaper per day than monthly', () => {
    expect(PLANS.annual.amount / PLANS.annual.days).toBeLessThan(PLANS.monthly.amount / PLANS.monthly.days)
  })
})

describe('isPlanId', () => {
  it('accepts valid plan ids', () => {
    expect(isPlanId('monthly')).toBe(true)
    expect(isPlanId('annual')).toBe(true)
  })

  it('rejects unknown strings', () => {
    expect(isPlanId('weekly')).toBe(false)
    expect(isPlanId('')).toBe(false)
  })
})

describe('calcExpiresAt', () => {
  it('monthly adds 30 days', () => {
    const from = new Date('2026-04-07T00:00:00Z')
    expect(calcExpiresAt(PLANS.monthly, from).getTime()).toBe(from.getTime() + 30 * 86400_000)
  })

  it('annual adds 365 days', () => {
    const from = new Date('2026-04-07T00:00:00Z')
    expect(calcExpiresAt(PLANS.annual, from).getTime()).toBe(from.getTime() + 365 * 86400_000)
  })
})

describe('daysRemaining', () => {
  it('returns 0 for past dates', () => {
    expect(daysRemaining(new Date(Date.now() - 1000))).toBe(0)
  })

  it('returns correct whole days', () => {
    expect(daysRemaining(new Date(Date.now() + 10 * 86400_000))).toBe(10)
  })

  it('rounds up partial days', () => {
    expect(daysRemaining(new Date(Date.now() + 1.5 * 86400_000))).toBe(2)
  })
})

describe('isExpiringSoon', () => {
  it('true when ≤ 7 days remain', () => {
    expect(isExpiringSoon(new Date(Date.now() + 6 * 86400_000))).toBe(true)
  })

  it('false when > 7 days remain', () => {
    expect(isExpiringSoon(new Date(Date.now() + 8 * 86400_000))).toBe(false)
  })
})

describe('TelegramStarsProvider', () => {
  const p = new TelegramStarsProvider()

  it('id=stars, flow=telegram_invoice', () => {
    expect(p.id).toBe('stars')
    expect(p.flow).toBe('telegram_invoice')
  })

  it('always available', () => { expect(p.isAvailable()).toBe(true) })
  it('empty token (Stars needs no provider_token)', () => { expect(p.getToken()).toBe('') })
  it('currency is XTR', () => { expect(p.getCurrency('monthly')).toBe('XTR') })
  it('correct Stars amounts', () => {
    expect(p.getAmount('monthly')).toBe(99)
    expect(p.getAmount('annual')).toBe(899)
  })
})

describe('TonCenterProvider', () => {
  const originalEnv = process.env.TON_WALLET_ADDRESS

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TON_WALLET_ADDRESS
    else process.env.TON_WALLET_ADDRESS = originalEnv
  })

  it('id=ton, flow=external_link', () => {
    const p = new TonCenterProvider()
    expect(p.id).toBe('ton')
    expect(p.flow).toBe('external_link')
  })

  it('unavailable when TON_WALLET_ADDRESS not set', () => {
    delete process.env.TON_WALLET_ADDRESS
    expect(new TonCenterProvider().isAvailable()).toBe(false)
  })

  it('available when TON_WALLET_ADDRESS is set', () => {
    process.env.TON_WALLET_ADDRESS = 'EQDtest123'
    expect(new TonCenterProvider().isAvailable()).toBe(true)
  })

  it('generates correct memo', () => {
    expect(new TonCenterProvider().memo(123456789n)).toBe('TRAILX-123456789')
  })

  it('creates Tonkeeper link with amount and memo', async () => {
    process.env.TON_WALLET_ADDRESS = 'EQDtest123'
    const link = await new TonCenterProvider().createPaymentLink('monthly', 42n)
    expect(link).toContain('app.tonkeeper.com/transfer/EQDtest123')
    expect(link).toContain('amount=2000000000')
    expect(link).toContain('TRAILX-42')
  })

  it('formats amounts correctly', () => {
    const p = new TonCenterProvider()
    expect(p.formatAmount('monthly')).toBe('2 TON')
    expect(p.formatAmount('annual')).toBe('18 TON')
  })
})

describe('CryptoPayProvider', () => {
  const originalEnv = process.env.CRYPTOPAY_TOKEN

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.CRYPTOPAY_TOKEN
    else process.env.CRYPTOPAY_TOKEN = originalEnv
  })

  it('id=cryptopay, flow=external_link', () => {
    expect(new CryptoPayProvider().id).toBe('cryptopay')
    expect(new CryptoPayProvider().flow).toBe('external_link')
  })

  it('unavailable when CRYPTOPAY_TOKEN not set', () => {
    delete process.env.CRYPTOPAY_TOKEN
    expect(new CryptoPayProvider().isAvailable()).toBe(false)
  })

  it('available when CRYPTOPAY_TOKEN is set', () => {
    process.env.CRYPTOPAY_TOKEN = 'test-token'
    expect(new CryptoPayProvider().isAvailable()).toBe(true)
  })

  it('validates correct signature', () => {
    const token = 'test-token'
    const body = '{"update_type":"invoice_paid"}'
    const secret = crypto.createHash('sha256').update(token).digest()
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')
    expect(CryptoPayProvider.validateSignature(token, body, sig)).toBe(true)
  })

  it('rejects tampered body', () => {
    const token = 'test-token'
    const body = '{"update_type":"invoice_paid"}'
    const secret = crypto.createHash('sha256').update(token).digest()
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')
    expect(CryptoPayProvider.validateSignature(token, '{"tampered":true}', sig)).toBe(false)
  })
})

describe('BePaidProvider', () => {
  const originalEnv = process.env.BEPAID_PROVIDER_TOKEN

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.BEPAID_PROVIDER_TOKEN
    else process.env.BEPAID_PROVIDER_TOKEN = originalEnv
  })

  it('name=bePaid', () => { expect(new BePaidProvider().name).toBe('bePaid') })

  it('returns token from env', () => {
    process.env.BEPAID_PROVIDER_TOKEN = 'test_token'
    expect(new BePaidProvider().getToken()).toBe('test_token')
  })

  it('returns empty string when env not set', () => {
    delete process.env.BEPAID_PROVIDER_TOKEN
    expect(new BePaidProvider().getToken()).toBe('')
  })
})
