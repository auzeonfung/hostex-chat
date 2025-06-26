import { NextRequest, NextResponse } from 'next/server';
import { listReplies } from '@/lib/db';

<<<<<<< 7z9xox-codex/开发hostex与chatgpt对接工具
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { replyId, content } = await req.json();
=======
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { replyId } = await req.json();
>>>>>>> main
  const token = process.env.HOSTEX_API_TOKEN;
  const baseUrl = process.env.HOSTEX_API_BASE || 'https://api.hostex.io/v3';

  if (!token) {
    return NextResponse.json({ error: 'HOSTEX_API_TOKEN not configured' }, { status: 500 });
  }

  const replies = await listReplies(params.id);
  const reply = replies.find((r) => r.id === replyId);

<<<<<<< 7z9xox-codex/开发hostex与chatgpt对接工具
  if (!reply && !content) {
=======
  if (!reply) {
>>>>>>> main
    return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
  }

  const res = await fetch(`${baseUrl}/send-message`, {
    method: 'POST',
    headers: {
      'Hostex-Access-Token': token,
      accept: 'application/json',
      'Content-Type': 'application/json',
    },
<<<<<<< 7z9xox-codex/开发hostex与chatgpt对接工具
    body: JSON.stringify({
      conversation_id: params.id,
      content: content ?? reply!.text,
    }),
=======
    body: JSON.stringify({ conversation_id: params.id, content: reply.text }),
>>>>>>> main
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  return NextResponse.json({ status: 'sent' });
}
