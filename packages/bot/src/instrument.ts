import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN && process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV ?? 'development',
  sendDefaultPii: true,
  enableLogs: true,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  includeLocalVariables: true,
})
