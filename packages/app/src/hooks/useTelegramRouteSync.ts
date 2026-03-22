import { useEffect } from 'react'
import { useMapStore } from '../store/useMapStore'

const BOT_WS_URL = (import.meta as { env: Record<string, string> }).env.VITE_BOT_WS_URL as string | undefined

interface RouteUpdateMessage {
  type: 'route:update'
  routeId: string
  waypoints: { lat: number; lng: number; name: string }[]
}

/**
 * Connects to the bot's WebSocket hub and applies incoming route:update
 * messages to the local store. TMA-only — only call when chatId is known.
 * Reconnects automatically with exponential backoff (max 3 attempts).
 */
export function useTelegramRouteSync(chatId: number | undefined): void {
  useEffect(() => {
    if (!chatId || !BOT_WS_URL) return

    let ws: WebSocket | null = null
    let attempts = 0
    let destroyed = false

    function connect(): void {
      if (destroyed) return
      const base = BOT_WS_URL!.replace(/^https?/, (m) => m === 'https' ? 'wss' : 'ws')
      ws = new WebSocket(`${base}/ws?chatId=${chatId}`)

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data) as RouteUpdateMessage
          if (msg.type !== 'route:update') return
          const { clearRoute, addWaypoint } = useMapStore.getState().actions
          clearRoute()
          msg.waypoints.forEach((wp, i) => {
            addWaypoint({
              id: crypto.randomUUID(),
              lat: wp.lat,
              lng: wp.lng,
              label: wp.name,
              order: i,
              type: 'start',
            })
          })
        } catch (err) {
          console.warn('[TelegramRouteSync] failed to parse message', err)
        }
      }

      ws.onclose = () => {
        if (destroyed) return
        attempts++
        if (attempts <= 3) {
          const delay = Math.pow(2, attempts) * 1000
          setTimeout(connect, delay)
        }
      }

      ws.onerror = () => ws?.close()
    }

    connect()

    return () => {
      destroyed = true
      ws?.close()
    }
  }, [chatId])
}
