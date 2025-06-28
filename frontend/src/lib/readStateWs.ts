import type { WebSocket } from 'ws'

const clients = new Set<WebSocket>()

export function addReadStateWsClient(ws: WebSocket) {
  clients.add(ws)
}

export function removeReadStateWsClient(ws: WebSocket) {
  clients.delete(ws)
}

export function broadcastReadStateWs(data: any) {
  const payload = JSON.stringify(data)
  for (const ws of Array.from(clients)) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload)
    } else {
      clients.delete(ws)
    }
  }
}
