import { promises as fs } from 'fs';
import path from 'path';

export interface Reply {
  id: string;
  conversationId: string;
  text: string;
  model: string;
  createdAt: string;
}

interface DB {
  replies: Reply[];
}

const DB_PATH = path.join(process.cwd(), 'db.json');

async function readDB(): Promise<DB> {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(data) as DB;
  } catch {
    return { replies: [] };
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
