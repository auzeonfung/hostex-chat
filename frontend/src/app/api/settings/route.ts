import { NextRequest, NextResponse } from 'next/server'
import { listSettings, addSetting } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const settings = await listSettings()
  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  const { name, data, pollInterval } = await req.json()
  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }
  const setting = await addSetting(name, data || {}, typeof pollInterval === 'number' ? pollInterval : 0)
  return NextResponse.json({ setting })
}
