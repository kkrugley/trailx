interface TelegramMainButton {
  hide(): void
  show(): void
  isVisible: boolean
}

interface TelegramWebApp {
  initData: string
  viewportStableHeight: number
  MainButton: TelegramMainButton
}

interface TelegramGlobal {
  WebApp?: TelegramWebApp
}

declare global {
  interface Window {
    Telegram?: TelegramGlobal
  }
}

export function useTelegramWebApp() {
  const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined

  return {
    webApp,
    isAvailable: webApp !== undefined,
  }
}

export type { TelegramWebApp, TelegramMainButton }
