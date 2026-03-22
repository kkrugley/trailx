import { useEffect, useRef, useState } from 'react'
import { useMapStore } from '../store/useMapStore'
import { getRoute } from '../services/api'
import { useTelegramRouteSync } from './useTelegramRouteSync'

// ── Type declarations ──────────────────────────────────────────────────────

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

interface TelegramChat {
  id: number
  type: string
  title?: string
}

interface TelegramInitDataUnsafe {
  start_param?: string
  user?: TelegramUser
  chat?: TelegramChat
  chat_type?: string
  auth_date?: number
  hash?: string
}

interface TelegramThemeParams {
  color_scheme?: 'light' | 'dark'
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
  header_bg_color?: string
  section_bg_color?: string
  subtitle_text_color?: string
  destructive_text_color?: string
  accent_text_color?: string
  bottom_bar_bg_color?: string
  section_separator_color?: string
}

export interface MainButtonAPI {
  text: string
  color: string
  textColor: string
  isVisible: boolean
  isActive: boolean
  isProgressVisible: boolean
  show(): void
  hide(): void
  enable(): void
  disable(): void
  showProgress(leaveActive?: boolean): void
  hideProgress(): void
  setText(text: string): void
  onClick(callback: () => void): void
  offClick(callback: () => void): void
  setParams(params: {
    text?: string
    color?: string
    text_color?: string
    is_active?: boolean
    is_visible?: boolean
  }): void
}

export interface BackButtonAPI {
  isVisible: boolean
  show(): void
  hide(): void
  onClick(callback: () => void): void
  offClick(callback: () => void): void
}

export interface HapticAPI {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
  notificationOccurred(type: 'error' | 'success' | 'warning'): void
  selectionChanged(): void
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: TelegramInitDataUnsafe
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: TelegramThemeParams
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  BackButton: BackButtonAPI
  MainButton: MainButtonAPI
  HapticFeedback: HapticAPI
  expand(): void
  close(): void
  ready(): void
  sendData(data: string): void
  openLink(url: string): void
  openTelegramLink(url: string): void
  setHeaderColor(color: 'bg_color' | 'secondary_bg_color' | (string & Record<never, never>)): void
  setBackgroundColor(color: string): void
  enableClosingConfirmation(): void
  disableClosingConfirmation(): void
  // Bot API 7.7+
  disableVerticalSwipes?(): void
  enableVerticalSwipes?(): void
  onEvent(eventType: string, eventHandler: () => void): void
  offEvent(eventType: string, eventHandler: () => void): void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

// ── CSS variable mapping for Telegram theme params ─────────────────────────

function applyThemeParams(params: TelegramThemeParams): void {
  const root = document.documentElement
  const set = (v: string, val: string | undefined) => {
    if (val) root.style.setProperty(v, val)
  }
  set('--primary', params.button_color)
  set('--on-primary', params.button_text_color)
  set('--secondary', params.link_color)
  set('--background', params.bg_color)
  set('--on-background', params.text_color)
  set('--on-surface-variant', params.hint_color)
  set('--surface', params.secondary_bg_color)
  set('--surface-variant', params.secondary_bg_color)
  set('--surface-container', params.header_bg_color ?? params.secondary_bg_color)
  set('--surface-container-high', params.section_bg_color ?? params.secondary_bg_color)
  if (params.color_scheme) {
    root.setAttribute('data-theme', params.color_scheme)
  }
}

// ── No-op stubs for non-TMA contexts ──────────────────────────────────────

const noopHaptic: HapticAPI = {
  impactOccurred: () => {},
  notificationOccurred: () => {},
  selectionChanged: () => {},
}

const noopBackButton: BackButtonAPI = {
  isVisible: false,
  show: () => {},
  hide: () => {},
  onClick: () => {},
  offClick: () => {},
}

// ── Deep link handler (called once, outside React render cycle) ────────────

async function handleStartParam(param: string): Promise<void> {
  const { clearRoute, addWaypoint } = useMapStore.getState().actions
  // Format: "r_<routeId>" → load shared route
  if (param.startsWith('r_')) {
    const routeId = param.slice(2)
    try {
      const remote = await getRoute(routeId)
      clearRoute()
      remote.waypoints.forEach((wp, i) => {
        addWaypoint({
          id: crypto.randomUUID(),
          lat: wp.lat,
          lng: wp.lng,
          label: wp.name,
          order: i,
          type: 'start', // assignTypes reassigns on each mutation
        })
      })
    } catch (err) {
      console.warn('[TMA] deep link route load failed:', err)
    }
  } else if (param === 'clear') {
    clearRoute()
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────

export interface TelegramWebAppResult {
  webApp: TelegramWebApp | undefined
  isAvailable: boolean
  /** Reactive viewportStableHeight in px. Falls back to window.innerHeight outside TMA. */
  stableHeight: number
  haptic: HapticAPI
  backButton: BackButtonAPI
}

export function useTelegramWebApp(): TelegramWebAppResult {
  const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
  const isAvailable = webApp !== undefined

  // Use window.innerHeight as the initial baseline — with viewport-fit=cover it
  // correctly reflects the full webview height including safe-area insets,
  // whereas viewportStableHeight from the TMA SDK may not account for them.
  const [stableHeight, setStableHeight] = useState<number>(
    () => typeof window !== 'undefined' ? window.innerHeight : 0,
  )

  const deepLinkHandled = useRef(false)

  // Group sync: listen for route updates broadcast by the bot via WebSocket
  const chatId = webApp?.initDataUnsafe.chat?.id
  useTelegramRouteSync(chatId)

  // Initialization — runs once when webApp becomes available
  useEffect(() => {
    if (!webApp) return

    webApp.ready()
    if (!webApp.isExpanded) webApp.expand()
    applyThemeParams(webApp.themeParams)
    // After expand(), re-read innerHeight — it now reflects the full TMA viewport
    setStableHeight(window.innerHeight)
    // Prevent accidental close by swipe-down on content (Bot API 7.7+)
    webApp.disableVerticalSwipes?.()
    // CSS fallback for older clients: mark body so the +1px trick applies
    document.body.classList.add('tma-active')

    if (!deepLinkHandled.current) {
      deepLinkHandled.current = true
      const startParam = webApp.initDataUnsafe.start_param
      if (startParam) void handleStartParam(startParam)
    }
  }, [webApp])

  // Sync viewport height on every resize/expand
  useEffect(() => {
    if (!webApp) return
    // Use window.innerHeight (accounts for viewport-fit=cover safe areas)
    // but only if it's larger than current — prevents keyboard-open shrink
    const handler = () => setStableHeight((prev) => Math.max(prev, window.innerHeight))
    webApp.onEvent('viewportChanged', handler)
    return () => webApp.offEvent('viewportChanged', handler)
  }, [webApp])

  // Re-apply theme when user switches Telegram appearance
  useEffect(() => {
    if (!webApp) return
    const handler = () => applyThemeParams(webApp.themeParams)
    webApp.onEvent('themeChanged', handler)
    return () => webApp.offEvent('themeChanged', handler)
  }, [webApp])

  return {
    webApp,
    isAvailable,
    stableHeight,
    haptic: webApp?.HapticFeedback ?? noopHaptic,
    backButton: webApp?.BackButton ?? noopBackButton,
  }
}
