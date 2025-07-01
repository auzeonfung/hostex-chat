import type { NextApiRequest, NextApiResponse } from 'next'
import { listConversations, listReadState } from '../../../../backend/db.js'

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const list = await listConversations()
  const reads = await listReadState()
  list.forEach((c: any) => { c.isRead = !!reads[c.id] })
  res.status(200).json({ conversations: list })
}
