import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { listConversations, listConversation, listMessages, listReadState, setReadState, getSetting } from './db.js';
import { addClient, removeClient, broadcast } from './events.js';
import { startPolling, pollOnce } from './poller.js';
import { LocalStorage } from 'node-localstorage';

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

const ls = new LocalStorage('./localStorage');
const activeId = ls.getItem('activeSettingId');
let interval = 0;
if (activeId) {
  const setting = getSetting(activeId);
  if (setting) interval = setting.pollInterval || 0;
}
app.post('/poll-now', async (_req, res) => {
  await pollOnce(broadcast);
  res.json({ status: 'ok' });
});

startPolling(broadcast, interval);

const port = process.env.PORT || 4000;
server.listen(port, () => {
  console.log('Backend listening on ' + port);
});
