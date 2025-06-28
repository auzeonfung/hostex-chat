import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db.sqlite');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    data TEXT,
    updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    data TEXT,
    created_at TEXT
  );
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
    created_at TEXT,
    updated_at TEXT
  );
`);

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  if (stmt.reader) {
    return stmt.all(params);
  }
  stmt.run(params);
  return [];
}

export function setReadState(conversationId, isRead) {
  run(
    `INSERT INTO read_state (conversation_id, is_read)
     VALUES (?, ?)
     ON CONFLICT(conversation_id) DO UPDATE SET is_read=excluded.is_read`,
    [conversationId, isRead ? 1 : 0]
  );
}

export function listReadState() {
  const rows = run(`SELECT conversation_id as conversationId, is_read as isRead FROM read_state`);
  const result = {};
  for (const r of rows) {
    result[r.conversationId] = !!r.isRead;
  }
  return result;
}

export function saveConversation(conv) {
  run(
    `INSERT INTO conversations (id, data, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
    [conv.id, JSON.stringify(conv), new Date().toISOString()]
  );
}

export function listConversations() {
  const rows = run(`SELECT id, data FROM conversations ORDER BY updated_at DESC`);
  return rows.map(r => ({ id: r.id, ...JSON.parse(r.data) }));
}

export function listConversation(id) {
  const rows = run(`SELECT data FROM conversations WHERE id=?`, [id]);
  if (!rows.length) return null;
  return { id, ...JSON.parse(rows[0].data) };
}

export function saveMessages(conversationId, messages) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO messages (id, conversation_id, data, created_at) VALUES (?, ?, ?, ?)`);
  const added = [];
  const insert = db.transaction(() => {
    for (const m of messages) {
      stmt.run(m.id, conversationId, JSON.stringify(m), m.created_at || new Date().toISOString());
      if (db.prepare('SELECT changes() as c').get().c) added.push(m);
    }
  });
  insert();
  return added;
}

export function listMessages(conversationId) {
  const rows = run(`SELECT data FROM messages WHERE conversation_id=? ORDER BY created_at`, [conversationId]);
  return rows.map(r => JSON.parse(r.data));
}
