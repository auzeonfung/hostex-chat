import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { addWebhookEvent, setReadState } from '@/lib/db';
import { broadcast } from '../../../../../../backend/events.js';
import { broadcastReadState } from '@/lib/readStateEvents';

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

  // Webhook signature validation disabled
  // if (signature !== expected) {
  //   console.warn('Invalid webhook signature');
  //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  // }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const obj = payload as Record<string, unknown>;
  const type = (obj['type'] ?? obj['event']) as string | undefined;
  if (type === 'message.created' || type === 'message_created') {
    const dataObj = (obj['data'] || {}) as Record<string, unknown>;
    const conversationId =
      (obj['conversation_id'] as string | undefined) ||
      (dataObj['conversation_id'] as string | undefined) ||
      (dataObj['conversationId'] as string | undefined);
    if (conversationId) {
      await setReadState(conversationId, false);
      broadcastReadState({ conversationId, read: false });
      const event = await addWebhookEvent({ type, conversationId, payload: obj });
      const payloadData = (event.payload as Record<string, unknown>)['data'];
      broadcast({ conversationId, message: payloadData || event.payload });
      console.log('Webhook event processed', { type, conversationId });
    }
  }

  return NextResponse.json({ status: 'ok' });
}
