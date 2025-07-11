import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { apiKey, endpoint } = await req.json();
  if (!apiKey) {
    return NextResponse.json({ error: 'apiKey required' }, { status: 400 });
  }
  const base = (endpoint || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
