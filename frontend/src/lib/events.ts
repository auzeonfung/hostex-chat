import type { WebSocket } from 'ws';

const clients = new Set<WebSocket>();

export function addClient(ws: WebSocket) {
  clients.add(ws);
}

export function removeClient(ws: WebSocket) {
  clients.delete(ws);
}

export function broadcast(data: any) {
  const payload = JSON.stringify(data);
  for (const ws of Array.from(clients)) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    } else {
      clients.delete(ws);
    }
  }
}
