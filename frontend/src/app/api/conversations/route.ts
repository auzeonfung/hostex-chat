import { NextResponse } from 'next/server';
import { getReadState } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const token = process.env.HOSTEX_API_TOKEN;
  const baseUrl = process.env.HOSTEX_API_BASE || 'https://api.hostex.io/v3';

  if (!token) {
    return NextResponse.json({ error: 'HOSTEX_API_TOKEN not configured' }, { status: 500 });
  }

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    offset: '0',
    limit: '50',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  });

  try {
    const res = await fetch(`${baseUrl}/conversations?${params.toString()}`, {
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
    const list =
      data.conversations ||
      data.items ||
      data.data?.conversations ||
      data.data?.items ||
      data.data ||
      data;

    if (Array.isArray(list)) {
      const ids = list.map((c: any) => c.id).filter(Boolean);
      const reads = await getReadState(ids);
      list.forEach((c: any) => {
        c.isRead = !!reads[c.id];
      });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
