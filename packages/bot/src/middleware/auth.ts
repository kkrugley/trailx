import { createHmac, timingSafeEqual } from 'node:crypto'
import type { FastifyRequest } from 'fastify'

export class AuthError extends Error {
  statusCode = 401
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export interface CallerIdentity {
  type: 'telegram' | 'device'
  telegramUserId?: bigint
  deviceId?: string
}

const DEVICE_ID_RE = /^[a-zA-Z0-9\-_]{10,128}$/

export function validateTelegramInitData(initData: string): CallerIdentity {
  const BOT_TOKEN = process.env.BOT_TOKEN ?? ''

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) throw new AuthError('Invalid initData')
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const expectedHex = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const expectedBuf = Buffer.from(expectedHex, 'hex')
  const hashBuf = Buffer.from(hash, 'hex')

  if (
    expectedBuf.length !== hashBuf.length ||
    !timingSafeEqual(expectedBuf, hashBuf)
  ) {
    throw new AuthError('Invalid initData')
  }

  const userJson = params.get('user')
  if (!userJson) throw new AuthError('Invalid initData: missing user')

  let user: { id: number }
  try {
    user = JSON.parse(userJson) as { id: number }
  } catch {
    throw new AuthError('Invalid initData: malformed user')
  }

  return { type: 'telegram', telegramUserId: BigInt(user.id) }
}

export function extractDeviceIdentity(deviceId: string): CallerIdentity {
  if (!DEVICE_ID_RE.test(deviceId)) {
    throw new AuthError('Invalid deviceId')
  }
  return { type: 'device', deviceId }
}

export function resolveIdentity(req: FastifyRequest): CallerIdentity {
  const initData = req.headers['x-telegram-initdata']
  if (typeof initData === 'string' && initData) {
    return validateTelegramInitData(initData)
  }

  const deviceId = req.headers['x-device-id']
  if (typeof deviceId === 'string' && deviceId) {
    return extractDeviceIdentity(deviceId)
  }

  throw new AuthError('No identity provided')
}
