import { addClient, removeClient } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(req: Request) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  addClient(writer);

  const keepAlive = setInterval(() => {
    writer.write(new TextEncoder().encode(':keep-alive\n\n')).catch(() => {});
  }, 15000);

  req.signal.addEventListener('abort', () => {
    clearInterval(keepAlive);
    removeClient(writer);
    writer.close();
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
