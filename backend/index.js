import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { listConversations, listConversation, listMessages, listReadState, setReadState } from './db.js';
import { addClient, removeClient, broadcast } from './events.js';
import { startPolling } from './poller.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/conversations', async (_req, res) => {
  const list = await listConversations();
  const reads = await listReadState();
  list.forEach(c => { c.isRead = !!reads[c.id]; });
  res.json({ conversations: list });
});

app.get('/conversations/:id', async (req, res) => {
  const conv = await listConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: 'not found' });
  const messages = await listMessages(req.params.id);
  res.json({ data: { ...conv, messages } });
});

app.get('/read-state', async (_req, res) => {
  res.json({ readState: await listReadState() });
});

app.post('/read-state', async (req, res) => {
  const { conversationId, read } = req.body || {};
  if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
  setReadState(conversationId, !!read);
  res.json({ status: 'ok' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/events' });
wss.on('connection', (ws) => {
  addClient(ws);
  ws.on('close', () => removeClient(ws));
});

startPolling(broadcast);

const port = process.env.PORT || 4000;
server.listen(port, () => {
  console.log('Backend listening on ' + port);
});
