import { NextRequest, NextResponse } from 'next/server'
import { listReadState, setReadState } from '@/lib/db'
import { broadcastReadState } from '@/lib/readStateEvents'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const data = await listReadState()
  return NextResponse.json({ readState: data })
}

export async function POST(req: NextRequest) {
  const { conversationId, read } = await req.json()
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
  }
  const val = !!read
  await setReadState(conversationId, val)
  broadcastReadState({ conversationId, read: val })
  return NextResponse.json({ status: 'ok' })
}
