import Database from 'better-sqlite3';
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

export interface OpenAILog {
  id: string;
  conversationId: string;
  payload: any;
  createdAt: string;
}

export interface Setting {
  id: string;
  name: string;
  data: any;
  pollInterval: number;
  createdAt: string;
  updatedAt: string;
}

const DB_PATH = path.join(process.cwd(), 'db.sqlite');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS replies (
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
  );
  CREATE TABLE IF NOT EXISTS openai_logs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    payload TEXT,
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS read_state (
    conversation_id TEXT PRIMARY KEY,
    is_read INTEGER
  );
  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    name TEXT,
    data TEXT,
    poll_interval INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  );
`);

function log(sql: string, params: any[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[db]', sql.trim(), params);
  }
}

async function run(sql: string, params: any[] = []): Promise<any[]> {
  log(sql, params);
  const stmt = db.prepare(sql);
  if (stmt.reader) {
    return stmt.all(params);
  }
  stmt.run(params);
  return [];
}

export async function addReply(
  reply: Omit<Reply, 'id' | 'createdAt'>
): Promise<Reply> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await run(
    `INSERT INTO replies (id, conversation_id, text, model, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, reply.conversationId, reply.text, reply.model, createdAt]
  );
  return { id, createdAt, ...reply };
}

export async function listReplies(conversationId: string): Promise<Reply[]> {
  const rows = await run(
    `SELECT id, conversation_id as conversationId, text, model, created_at as createdAt
     FROM replies WHERE conversation_id=? ORDER BY created_at`,
    [conversationId]
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
     VALUES (?, ?, ?, ?, ?)`,
    [id, event.type, event.conversationId, JSON.stringify(event.payload), receivedAt]
  );
  return { id, receivedAt, ...event };
}

export async function listWebhookEvents(
  conversationId?: string,
): Promise<WebhookEvent[]> {
  const where = conversationId
    ? `WHERE conversation_id=?`
    : '';
  const rows = await run(
    `SELECT id, type, conversation_id as conversationId, payload, received_at as receivedAt
     FROM webhook_events ${where} ORDER BY received_at`,
    conversationId ? [conversationId] : []
  );
  return rows.map((r: any) => ({
    ...r,
    payload: JSON.parse(r.payload),
  }));
}

export async function addOpenAILog(
  log: Omit<OpenAILog, 'id' | 'createdAt'>,
): Promise<OpenAILog> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await run(
    `INSERT INTO openai_logs (id, conversation_id, payload, created_at)
     VALUES (?, ?, ?, ?)`,
    [id, log.conversationId, JSON.stringify(log.payload), createdAt]
  );
  return { id, createdAt, ...log };
}

export async function listOpenAILogs(
  conversationId: string,
): Promise<OpenAILog[]> {
  const rows = await run(
    `SELECT id, conversation_id as conversationId, payload, created_at as createdAt
     FROM openai_logs WHERE conversation_id=? ORDER BY created_at`,
    [conversationId]
  );
  return rows.map((r: any) => ({
    ...r,
    payload: JSON.parse(r.payload),
  }));
}

export async function setReadState(conversationId: string, isRead: boolean) {
  await run(
    `INSERT INTO read_state (conversation_id, is_read)
     VALUES (?, ?)
     ON CONFLICT(conversation_id) DO UPDATE SET is_read=excluded.is_read`,
    [conversationId, isRead ? 1 : 0]
  );
}

export async function listReadState(): Promise<Record<string, boolean>> {
  const rows = await run(
    `SELECT conversation_id as conversationId, is_read as isRead FROM read_state`
  );
  const result: Record<string, boolean> = {};
  for (const r of rows) {
    result[r.conversationId] = !!r.isRead;
  }
  return result;
}

export async function getReadState(
  conversationIds: string[],
): Promise<Record<string, boolean>> {
  if (!conversationIds.length) {
    return {};
  }
  const placeholders = conversationIds.map(() => '?').join(',');
  const rows = await run(
    `SELECT conversation_id as conversationId, is_read as isRead FROM read_state WHERE conversation_id IN (${placeholders})`,
    conversationIds,
  );
  const result: Record<string, boolean> = {};
  for (const r of rows) {
    result[r.conversationId] = !!r.isRead;
  }
  return result;
}

export async function listSettings(): Promise<Setting[]> {
  const rows = await run(
    `SELECT id, name, data, poll_interval as pollInterval, created_at as createdAt, updated_at as updatedAt FROM settings`
  );
  return rows.map((r: any) => ({ ...r, data: JSON.parse(r.data), pollInterval: r.pollInterval ?? 0 }));
}

export async function getSetting(id: string): Promise<Setting | undefined> {
  const rows = await run(
    `SELECT id, name, data, poll_interval as pollInterval, created_at as createdAt, updated_at as updatedAt FROM settings WHERE id=?`,
    [id]
  );
  const r = rows[0];
  return r ? { ...r, data: JSON.parse(r.data), pollInterval: r.pollInterval ?? 0 } : undefined;
}

export async function addSetting(name: string, data: any, pollInterval = 0): Promise<Setting> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(
    `INSERT INTO settings (id, name, data, poll_interval, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, JSON.stringify(data), pollInterval, now, now]
  );
  return { id, name, data, pollInterval, createdAt: now, updatedAt: now };
}

export async function updateSetting(id: string, name: string, data: any, pollInterval = 0) {
  const now = new Date().toISOString();
  await run(
    `UPDATE settings SET name=?, data=?, poll_interval=?, updated_at=? WHERE id=?`,
    [name, JSON.stringify(data), pollInterval, now, id]
  );
}

export async function deleteSetting(id: string) {
  await run(`DELETE FROM settings WHERE id=?`, [id]);
}
