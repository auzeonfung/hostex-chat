import { NextResponse } from 'next/server'
import { listOpenAILogs } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const logs = await listOpenAILogs(params.id)
  return NextResponse.json({ logs })
}
