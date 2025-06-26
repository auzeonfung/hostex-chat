import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import crypto from 'crypto';

const exec = promisify(execFile);

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

const DB_PATH = path.join(process.cwd(), 'db.sqlite');

function log(...args: any[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[db]', ...args);
  }
}

async function run(sql: string): Promise<any[]> {
  log('execute', sql.trim());
  const { stdout } = await exec('sqlite3', ['-json', DB_PATH, sql]);
  const out = stdout.trim();
  return out ? JSON.parse(out) : [];
}

async function init() {
  await exec('sqlite3', [
    DB_PATH,
    `CREATE TABLE IF NOT EXISTS replies (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      text TEXT,
      model TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      type TEXT,
      conversation_id TEXT,
      payload TEXT,
      received_at TEXT
    );`,
  ]);
}

init().catch((err) => console.error('DB init failed', err));

function q(value: string): string {
  return value.replace(/'/g, "''");
}

export async function addReply(
  reply: Omit<Reply, 'id' | 'createdAt'>
): Promise<Reply> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await run(
    `INSERT INTO replies (id, conversation_id, text, model, created_at)
     VALUES ('${id}', '${q(reply.conversationId)}', '${q(reply.text)}', '${q(
      reply.model,
    )}', '${createdAt}');`,
  );
  return { id, createdAt, ...reply };
}

export async function listReplies(conversationId: string): Promise<Reply[]> {
  const rows = await run(
    `SELECT id, conversation_id as conversationId, text, model, created_at as createdAt
     FROM replies WHERE conversation_id='${q(conversationId)}' ORDER BY created_at`,
  );
  return rows as Reply[];
}

export async function addWebhookEvent(
  event: Omit<WebhookEvent, 'id' | 'receivedAt'>,
): Promise<WebhookEvent> {
  const id = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  await run(
    `INSERT INTO webhook_events (id, type, conversation_id, payload, received_at)
     VALUES ('${id}', '${q(event.type)}', '${q(event.conversationId)}', '${q(
      JSON.stringify(event.payload),
    )}', '${receivedAt}');`,
  );
  return { id, receivedAt, ...event };
}

export async function listWebhookEvents(
  conversationId?: string,
): Promise<WebhookEvent[]> {
  const where = conversationId
    ? `WHERE conversation_id='${q(conversationId)}'`
    : '';
  const rows = await run(
    `SELECT id, type, conversation_id as conversationId, payload, received_at as receivedAt
     FROM webhook_events ${where} ORDER BY received_at`,
  );
  return rows.map((r: any) => ({
    ...r,
    payload: JSON.parse(r.payload),
  }));
}
