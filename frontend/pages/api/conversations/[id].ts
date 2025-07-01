import type { NextApiRequest, NextApiResponse } from 'next'
import { listConversation, listMessages } from '../../../../backend/db.js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string
  const conv = await listConversation(id)
  if (!conv) return res.status(404).json({ error: 'not found' })
  const messages = await listMessages(id)
  res.status(200).json({ data: { ...conv, messages } })
}
