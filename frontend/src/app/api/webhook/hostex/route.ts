import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { addWebhookEvent } from '@/lib/db';
import { broadcast } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = process.env.HOSTEX_API_TOKEN;
  if (!secret) {
    return NextResponse.json(
      { error: 'HOSTEX_API_TOKEN not configured' },
      { status: 500 }
    );
  }

  const signature = req.headers.get('hostex-signature');
  const rawBody = await req.text();
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  console.log('Webhook received', { signature, expected, body: rawBody });

  if (signature !== expected) {
    console.warn('Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type = payload.type || payload.event;
  if (type === 'message.created' || type === 'message_created') {
    const conversationId =
      payload.conversation_id || payload.data?.conversation_id || payload.data?.conversationId;
    if (conversationId) {
      const event = await addWebhookEvent({ type, conversationId, payload });
      broadcast({ conversationId, message: event.payload?.data || event.payload });
      console.log('Webhook event processed', { type, conversationId });
    }
  }

  return NextResponse.json({ status: 'ok' });
}
