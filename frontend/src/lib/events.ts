const encoder = new TextEncoder();
const clients = new Set<WritableStreamDefaultWriter>();

export function addClient(writer: WritableStreamDefaultWriter) {
  clients.add(writer);
}

export function removeClient(writer: WritableStreamDefaultWriter) {
  clients.delete(writer);
}

export function broadcast(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  const encoded = encoder.encode(payload);
  for (const writer of Array.from(clients)) {
    writer.write(encoded).catch(() => {
      clients.delete(writer);
    });
  }
}
