import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface Reply {
  id: string;
  conversationId: string;
  text: string;
  model: string;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  conversationId: string;
  payload: any;
  receivedAt: string;
}

interface DB {
  replies: Reply[];
  events: WebhookEvent[];
}

const DB_PATH = path.join(process.cwd(), 'db.json');

async function readDB(): Promise<DB> {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(data) as Partial<DB>;
    return {
      replies: parsed.replies ?? [],
      events: parsed.events ?? [],
    };
  } catch {
    return { replies: [], events: [] };
  }
}

async function writeDB(db: DB) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

export async function addReply(reply: Omit<Reply, 'id' | 'createdAt'>): Promise<Reply> {
  const db = await readDB();
  const newReply: Reply = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...reply,
  };
  db.replies.push(newReply);
  await writeDB(db);
  return newReply;
}

export async function listReplies(conversationId: string): Promise<Reply[]> {
  const db = await readDB();
  return db.replies.filter((r) => r.conversationId === conversationId);
}

export async function addWebhookEvent(
  event: Omit<WebhookEvent, 'id' | 'receivedAt'>
): Promise<WebhookEvent> {
  const db = await readDB();
  const newEvent: WebhookEvent = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    ...event,
  };
  db.events.push(newEvent);
  await writeDB(db);
  return newEvent;
}

export async function listWebhookEvents(
  conversationId?: string
): Promise<WebhookEvent[]> {
  const db = await readDB();
  return conversationId
    ? db.events.filter((e) => e.conversationId === conversationId)
    : db.events;
}
