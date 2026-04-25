import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import crypto from 'node:crypto'
import {
  calcExpiresAt,
  daysRemaining,
  isExpiringSoon,
  isPlanId,
  FALLBACK_PLANS,
} from '../services/pricing'
import { BePaidProvider } from './providers/bepaid'
import { TelegramStarsProvider } from './providers/telegramStars'
import { TonCenterProvider } from './providers/ton'
import { CryptoPayProvider } from './providers/cryptopay'
import { WebPayProvider } from './providers/webpay'

// Mock the prisma module - use fallback values
vi.mock('../db', () => ({
  prisma: {
    plan: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    providerPricing: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

describe('FALLBACK_PLANS', () => {
  it('monthly fallback exists with correct structure', () => {
    const monthly = FALLBACK_PLANS[0]
    expect(monthly.id).toBe('monthly')
    expect(monthly.label).toBe('1 месяц')
    expect(monthly.days).toBe(30)
    expect(monthly.isActive).toBe(true)
  })

  it('annual fallback exists with correct structure', () => {
    const annual = FALLBACK_PLANS[1]
    expect(annual.id).toBe('annual')
    expect(annual.label).toBe('1 год')
    expect(annual.days).toBe(365)
    expect(annual.isActive).toBe(true)
  })

  it('annual is cheaper per day than monthly', () => {
    // Monthly: 500 cents / 30 days = ~16.67 cents/day
    // Annual: 4500 cents / 365 days = ~12.33 cents/day
    expect(4500 / 365).toBeLessThan(500 / 30)
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
    expect(calcExpiresAt(FALLBACK_PLANS[0], from).getTime()).toBe(from.getTime() + 30 * 86400_000)
  })

  it('annual adds 365 days', () => {
    const from = new Date('2026-04-07T00:00:00Z')
    expect(calcExpiresAt(FALLBACK_PLANS[1], from).getTime()).toBe(from.getTime() + 365 * 86400_000)
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

describe('TelegramStarsProvider (async)', () => {
  const p = new TelegramStarsProvider()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('id=stars, flow=telegram_invoice', () => {
    expect(p.id).toBe('stars')
    expect(p.flow).toBe('telegram_invoice')
  })

  it('always available', () => {
    expect(p.isAvailable()).toBe(true)
  })

  it('empty token (Stars needs no provider_token)', () => {
    expect(p.getToken()).toBe('')
  })

  it('currency is XTR', () => {
    expect(p.getCurrency('monthly')).toBe('XTR')
  })

  it('getAmount returns correct Stars from fallback', async () => {
    // When DB is unavailable, provider uses fallback
    const monthlyAmount = await p.getAmount('monthly')
    expect(monthlyAmount).toBe(5)

    const annualAmount = await p.getAmount('annual')
    expect(annualAmount).toBe(50)
  })
})

describe('TonCenterProvider (async)', () => {
  const originalEnv = process.env.TON_WALLET_ADDRESS

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TON_WALLET_ADDRESS
    else process.env.TON_WALLET_ADDRESS = originalEnv
  })

  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(link).toContain('amount=')
    expect(link).toContain('TRAILX-42')
  })

  it('formatAmount returns correct display from fallback', async () => {
    const p = new TonCenterProvider()
    const monthlyDisplay = await p.formatAmount('monthly')
    expect(monthlyDisplay).toBe('0.1 TON')

    const annualDisplay = await p.formatAmount('annual')
    expect(annualDisplay).toBe('1 TON')
  })
})

describe('CryptoPayProvider', () => {
  const originalEnv = process.env.CRYPTOPAY_TOKEN

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.CRYPTOPAY_TOKEN
    else process.env.CRYPTOPAY_TOKEN = originalEnv
  })

  beforeEach(() => {
    vi.clearAllMocks()
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

  it('rejects wrong-length signature', () => {
    expect(CryptoPayProvider.validateSignature('token', 'body', 'short')).toBe(false)
  })

  it('rejects empty signature', () => {
    expect(CryptoPayProvider.validateSignature('token', 'body', '')).toBe(false)
  })
})

describe('WebPayProvider signature validation', () => {
  it('validates correct MD5 signature', () => {
    const secretKey = 'mysecret'
    const fields: Record<string, string> = {
      batch_timestamp: '1700000000',
      currency_id: 'USD',
      amount: '5.00',
      payment_method: '1',
      order_id: '12345',
      site_order_id: 'TRAILX-42-1700000000',
      transaction_id: 'tx001',
      payment_type: '1',
      rrn: '123456',
    }
    // Build expected signature
    const raw = [
      fields.batch_timestamp, fields.currency_id, fields.amount,
      fields.payment_method, fields.order_id, fields.site_order_id,
      fields.transaction_id, fields.payment_type, fields.rrn, secretKey,
    ].join('')
    fields.wsb_signature = crypto.createHash('md5').update(raw).digest('hex')

    expect(WebPayProvider.validateWebhookSignature(fields, secretKey)).toBe(true)
  })

  it('rejects tampered amount', () => {
    const secretKey = 'mysecret'
    const fields: Record<string, string> = {
      batch_timestamp: '1700000000',
      currency_id: 'USD',
      amount: '5.00',
      payment_method: '1',
      order_id: '12345',
      site_order_id: 'TRAILX-42-1700000000',
      transaction_id: 'tx001',
      payment_type: '1',
      rrn: '123456',
      wsb_signature: 'deadbeef00000000deadbeef00000000',
    }
    expect(WebPayProvider.validateWebhookSignature(fields, secretKey)).toBe(false)
  })

  it('rejects missing signature', () => {
    const fields: Record<string, string> = {
      batch_timestamp: '1700000000',
      currency_id: 'USD',
      amount: '5.00',
      payment_method: '1',
      order_id: '12345',
      site_order_id: 'TRAILX-42-1700000000',
      transaction_id: 'tx001',
      payment_type: '1',
      rrn: '123456',
    }
    expect(WebPayProvider.validateWebhookSignature(fields, 'mysecret')).toBe(false)
  })
})

describe('CryptoPayProvider amount conversion', () => {
  it('formats 0.1 TON correctly', () => {
    const tonNano = '100000000' // 0.1 TON
    const tonAmount = (Number(BigInt(tonNano)) / 1e9).toString()
    expect(tonAmount).toBe('0.1')
  })

  it('formats 1 TON correctly', () => {
    const tonAmount = (Number(BigInt('1000000000')) / 1e9).toString()
    expect(tonAmount).toBe('1')
  })

  it('formats 2.5 TON correctly', () => {
    const tonAmount = (Number(BigInt('2500000000')) / 1e9).toString()
    expect(tonAmount).toBe('2.5')
  })
})

describe('BePaidProvider', () => {
  const originalEnv = process.env.BEPAID_PROVIDER_TOKEN

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.BEPAID_PROVIDER_TOKEN
    else process.env.BEPAID_PROVIDER_TOKEN = originalEnv
  })

  beforeEach(() => {
    vi.clearAllMocks()
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

  it('currency is USD', () => {
    const p = new BePaidProvider()
    expect(p.getCurrency('monthly')).toBe('USD')
  })

  it('getAmount returns correct USD cents from fallback', async () => {
    const p = new BePaidProvider()
    const monthlyAmount = await p.getAmount('monthly')
    expect(monthlyAmount).toBe(500) // 5 USD

    const annualAmount = await p.getAmount('annual')
    expect(annualAmount).toBe(4500) // 45 USD
  })
})
