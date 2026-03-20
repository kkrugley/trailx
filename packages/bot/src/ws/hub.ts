// WebSocket hub: tracks per-chat connected TMA clients and broadcasts
// route updates so all open instances stay in sync.

interface WsClient {
  readyState: number
  send(data: string): void
}

// chatId string → set of connected sockets
const clients = new Map<string, Set<WsClient>>()

export function registerClient(chatId: string, socket: WsClient): void {
  if (!clients.has(chatId)) clients.set(chatId, new Set())
  clients.get(chatId)!.add(socket)
}

export function unregisterClient(chatId: string, socket: WsClient): void {
  clients.get(chatId)?.delete(socket)
}

export function broadcastRouteUpdate(
  chatId: string,
  routeId: string,
  waypoints: unknown,
): void {
  const payload = JSON.stringify({ type: 'route:update', routeId, waypoints })
  const sockets = clients.get(chatId) ?? new Set()
  for (const socket of sockets) {
    if (socket.readyState === 1 /* OPEN */) {
      socket.send(payload)
    }
  }
}
