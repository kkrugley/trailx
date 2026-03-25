import { describe, it, expect, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  validateTelegramInitData,
  extractDeviceIdentity,
  resolveIdentity,
  AuthError,
} from './auth.js'
import type { FastifyRequest } from 'fastify'

const TEST_BOT_TOKEN = 'test-bot-token-123'

/** Build a valid initData string signed with TEST_BOT_TOKEN */
function makeInitData(userId: number, botToken: string): string {
  const user = JSON.stringify({ id: userId })
  const params = new URLSearchParams({ user })

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  params.set('hash', hash)
  return params.toString()
}

function makeRequest(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest
}

describe('validateTelegramInitData', () => {
  beforeEach(() => {
    process.env.BOT_TOKEN = TEST_BOT_TOKEN
  })

  it('returns telegramUserId for valid initData', () => {
    const initData = makeInitData(42, TEST_BOT_TOKEN)
    const identity = validateTelegramInitData(initData)
    expect(identity.type).toBe('telegram')
    expect(identity.telegramUserId).toBe(42n)
  })

  it('throws AuthError for wrong hash', () => {
    const initData = makeInitData(42, 'wrong-token')
    expect(() => validateTelegramInitData(initData)).toThrow(AuthError)
  })

  it('throws AuthError when hash is missing', () => {
    expect(() => validateTelegramInitData('user=%7B%22id%22%3A1%7D')).toThrow(AuthError)
  })

  it('throws AuthError for tampered data', () => {
    const initData = makeInitData(42, TEST_BOT_TOKEN)
    // Tamper: replace user id
    const tampered = initData.replace(/%22id%22%3A42/, '%22id%22%3A99')
    expect(() => validateTelegramInitData(tampered)).toThrow(AuthError)
  })
})

describe('extractDeviceIdentity', () => {
  it('returns device identity for valid deviceId', () => {
    const identity = extractDeviceIdentity('valid-device-id-123')
    expect(identity.type).toBe('device')
    expect(identity.deviceId).toBe('valid-device-id-123')
  })

  it('throws AuthError for deviceId with special characters', () => {
    expect(() => extractDeviceIdentity('bad device id!')).toThrow(AuthError)
  })

  it('throws AuthError for deviceId shorter than 10 chars', () => {
    expect(() => extractDeviceIdentity('short')).toThrow(AuthError)
  })

  it('throws AuthError for deviceId longer than 128 chars', () => {
    expect(() => extractDeviceIdentity('a'.repeat(129))).toThrow(AuthError)
  })
})

describe('resolveIdentity', () => {
  beforeEach(() => {
    process.env.BOT_TOKEN = TEST_BOT_TOKEN
  })

  it('uses x-telegram-initdata header when present', () => {
    const initData = makeInitData(7, TEST_BOT_TOKEN)
    const req = makeRequest({ 'x-telegram-initdata': initData })
    const identity = resolveIdentity(req)
    expect(identity.type).toBe('telegram')
    expect(identity.telegramUserId).toBe(7n)
  })

  it('uses x-device-id header when telegram header is absent', () => {
    const req = makeRequest({ 'x-device-id': 'device-abc-12345' })
    const identity = resolveIdentity(req)
    expect(identity.type).toBe('device')
    expect(identity.deviceId).toBe('device-abc-12345')
  })

  it('throws AuthError when no identity header is provided', () => {
    const req = makeRequest({})
    expect(() => resolveIdentity(req)).toThrow(AuthError)
  })

  it('AuthError has statusCode 401', () => {
    const req = makeRequest({})
    try {
      resolveIdentity(req)
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError)
      expect((err as AuthError).statusCode).toBe(401)
    }
  })
})
