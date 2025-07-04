import fetch from 'node-fetch';
import { saveConversation, saveMessages, setReadState } from './db.js';

const token = process.env.HOSTEX_API_TOKEN;
const baseUrl = process.env.HOSTEX_API_BASE || 'https://api.hostex.io/v3';

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'Hostex-Access-Token': token, accept: 'application/json' }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function pollOnce(onUpdate) {
  if (!token) {
    console.error('HOSTEX_API_TOKEN not configured');
    return;
  }
  try {
    const data = await fetchJSON(`${baseUrl}/conversations?offset=0&limit=50`);
    const list =
      data.conversations || data.items || data.data?.conversations || data.data?.items || data.data || data;
    if (!Array.isArray(list)) return;
    for (const conv of list) {
      await saveConversation(conv);
      const detail = await fetchJSON(`${baseUrl}/conversations/${conv.id}`);
      const d = detail.data || detail;
      let messages = d.messages;
      if (!Array.isArray(messages)) {
        try {
          const m = await fetchJSON(`${baseUrl}/conversations/${conv.id}/messages`);
          messages = m.messages || m.items || m.data?.messages || m.data?.items || m.data || m;
        } catch (err) {
          console.error('poll error', 'messages fetch', err.message);
          messages = [];
        }
      }
      const added = await saveMessages(conv.id, messages || []);
      if (added.length) {
        for (const m of added) {
          if (m.sender_role !== 'host') {
            setReadState(conv.id, false);
          }
        }
        if (onUpdate) onUpdate({ conversationId: conv.id });
      }
    }
  } catch (err) {
    console.error('poll error', err.message);
  }
}

export function startPolling(onUpdate, interval) {
  if (!token) {
    console.error('HOSTEX_API_TOKEN not configured');
    return;
  }
  if (interval && interval > 0) {
    setInterval(() => pollOnce(onUpdate), interval * 60 * 1000);
  }
}

