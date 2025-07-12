import { NextResponse } from 'next/server';
import type { ConversationDetail } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const token = process.env.HOSTEX_API_TOKEN;
  const baseUrl = process.env.HOSTEX_API_BASE || 'https://api.hostex.io/v3';

  if (!token) {
    return NextResponse.json(
      { error: 'HOSTEX_API_TOKEN not configured' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${baseUrl}/conversations/${params.id}`, {
      headers: {
        'Hostex-Access-Token': token,
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
