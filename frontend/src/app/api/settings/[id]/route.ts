import { NextRequest, NextResponse } from 'next/server'
import { getSetting, updateSetting, deleteSetting } from '@/lib/db'
import type { SettingData } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const setting = await getSetting(params.id)
  if (!setting) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ setting })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { name, data, pollInterval } = (await req.json()) as {
    name: string
    data?: SettingData
    pollInterval?: number
  }
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  await updateSetting(
    params.id,
    name,
    (data || {}) as SettingData,
    typeof pollInterval === 'number' ? pollInterval : 0
  )
  return NextResponse.json({ status: 'ok' })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await deleteSetting(params.id)
  return NextResponse.json({ status: 'ok' })
}
