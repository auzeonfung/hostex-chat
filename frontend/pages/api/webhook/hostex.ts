import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { addWebhookEvent, setReadState } from '@/lib/db'
import { broadcastReadState } from '@/lib/readStateEvents'
import { broadcast } from '@/lib/events'

export const config = {
  api: { bodyParser: false },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const token = process.env.HOSTEX_API_TOKEN || ''
  let data = ''
  for await (const chunk of req) {
    data += chunk
  }
  const signature = (req.headers['hostex-signature'] || '') as string
  const expected = crypto.createHmac('sha256', token).update(data).digest('hex')
  if (signature !== expected) {
    res.statusCode = 401
    return res.end('Invalid signature')
  }

  let payload: any
  try {
    payload = JSON.parse(data)
  } catch {
    res.statusCode = 400
    return res.end('Invalid JSON')
  }

  const type = payload.type || payload.event
  if (type === 'message.created' || type === 'message_created') {
    const conversationId =
      payload.conversation_id || payload.data?.conversation_id || payload.data?.conversationId
    if (conversationId) {
      try {
        await setReadState(conversationId, false)
        broadcastReadState({ conversationId, read: false })
        const event = await addWebhookEvent({ type, conversationId, payload })
        broadcast({ conversationId, message: event.payload?.data || event.payload })
      } catch (err) {
        console.error('Failed to store webhook event', err)
      }
    }
  }

  res.end('ok')
}
