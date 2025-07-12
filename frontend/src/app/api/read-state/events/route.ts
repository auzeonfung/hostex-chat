import { NextRequest } from 'next/server'
import { addReadStateClient, removeReadStateClient } from '@/lib/readStateEvents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  const send = (data: Record<string, unknown>) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }

  addReadStateClient(send)

  const keep = setInterval(() => {
    writer.write(encoder.encode(':keep-alive\n\n'))
  }, 15000)

  req.signal.addEventListener('abort', () => {
    clearInterval(keep)
    removeReadStateClient(send)
    writer.close()
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
