import http from 'http'
import crypto from 'crypto'
import { addWebhookEvent, setReadState } from '../frontend/src/lib/db'
import { broadcastReadState } from '../frontend/src/lib/readStateEvents'
import { broadcast } from '../frontend/src/lib/events'

const PORT = parseInt(process.env.WEBHOOK_PORT || '3100', 10)
const TOKEN = process.env.HOSTEX_API_TOKEN

if (!TOKEN) {
  console.error('HOSTEX_API_TOKEN environment variable not set')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/hostex') {
    res.statusCode = 404
    return res.end('Not Found')
  }

  let data = ''
  req.on('data', chunk => { data += chunk })
  req.on('end', async () => {
    const signature = (req.headers['hostex-signature'] || '') as string
    const expected = crypto.createHmac('sha256', TOKEN).update(data).digest('hex')
    // Webhook signature validation disabled
    // if (signature !== expected) {
    //   console.warn('Invalid webhook signature')
    //   res.statusCode = 401
    //   return res.end('Invalid signature')
    // }

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
          console.log('Processed webhook event', { type, conversationId })
        } catch (err) {
          console.error('Failed to store webhook event', err)
        }
      }
    }

    res.end('ok')
  })
})

server.listen(PORT, () => {
  console.log(`Webhook worker listening on http://localhost:${PORT}/hostex`)
})
