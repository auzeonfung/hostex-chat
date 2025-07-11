import { NextRequest, NextResponse } from 'next/server';
import { addReply, listReplies, addOpenAILog } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const replies = await listReplies(params.id);
  return NextResponse.json({ replies });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { messages, model = 'gpt-3.5-turbo', apiKey, endpoint } = await req.json();
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  await addOpenAILog({ conversationId: params.id, payload: { model, messages } });

  const base = (endpoint || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  const reply = await addReply({ conversationId: params.id, text: content, model });
  return NextResponse.json({ reply });
}
