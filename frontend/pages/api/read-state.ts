import type { NextApiRequest, NextApiResponse } from 'next'
import { listReadState, setReadState } from '../../../backend/db.js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const readState = await listReadState()
    res.status(200).json({ readState })
  } else if (req.method === 'POST') {
    const { conversationId, read } = req.body || {}
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' })
    setReadState(conversationId, !!read)
    res.status(200).json({ status: 'ok' })
  } else {
    res.status(405).end()
  }
}
