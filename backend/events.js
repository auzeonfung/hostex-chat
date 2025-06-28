const clients = new Set();

export function addClient(ws) {
  clients.add(ws);
}

export function removeClient(ws) {
  clients.delete(ws);
}

export function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const ws of Array.from(clients)) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    } else {
      clients.delete(ws);
    }
  }
}
