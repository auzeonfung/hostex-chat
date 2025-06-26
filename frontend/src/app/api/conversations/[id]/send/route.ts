import { NextRequest, NextResponse } from 'next/server';
import { listReplies } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { replyId, content } = await req.json();
  const token = process.env.HOSTEX_API_TOKEN;
  const baseUrl = process.env.HOSTEX_API_BASE || 'https://api.hostex.io/v3';

  if (!token) {
    return NextResponse.json({ error: 'HOSTEX_API_TOKEN not configured' }, { status: 500 });
  }

  const replies = await listReplies(params.id);
  const reply = replies.find((r) => r.id === replyId);

  if (!reply && !content) {
    return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
  }

  const res = await fetch(`${baseUrl}/conversations/${params.id}`, {
    method: 'POST',
    headers: {
      'Hostex-Access-Token': token,
      accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: content ?? reply!.text,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  return NextResponse.json({ status: 'sent' });
}
