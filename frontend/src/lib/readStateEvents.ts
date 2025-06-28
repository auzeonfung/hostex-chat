const clients = new Set<(data: any) => void>();

export function addReadStateClient(fn: (data: any) => void) {
  clients.add(fn);
}

export function removeReadStateClient(fn: (data: any) => void) {
  clients.delete(fn);
}

export function broadcastReadState(data: any) {
  for (const fn of Array.from(clients)) {
    try {
      fn(data);
    } catch {
      clients.delete(fn);
    }
  }
}
