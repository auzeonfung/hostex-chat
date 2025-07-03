import { createRequire } from 'module';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { listConversations, listConversation, listMessages, listReadState, setReadState } from './backend/db.js';
import { addClient, removeClient, broadcast } from './backend/events.js';
import { startPolling } from './backend/poller.js';

const require = createRequire(new URL('./frontend/package.json', import.meta.url));
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, dir: './frontend' });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/conversations', async (_req, res) => {
    const list = await listConversations();
    const reads = await listReadState();
    list.forEach(c => {
      c.isRead = !!reads[c.id];
    });
    res.json({ conversations: list });
  });

  app.get('/api/conversations/:id', async (req, res) => {
    const conv = await listConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'not found' });
    const messages = await listMessages(req.params.id);
    res.json({ data: { ...conv, messages } });
  });

  app.get('/api/read-state', async (_req, res) => {
    res.json({ readState: await listReadState() });
  });

  app.post('/api/read-state', async (req, res) => {
    const { conversationId, read } = req.body || {};
    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId required' });
    }
    setReadState(conversationId, !!read);
    res.json({ status: 'ok' });
  });

  app.all('*', (req, res) => handle(req, res));

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: '/api/events' });
  wss.on('connection', ws => {
    addClient(ws);
    ws.on('close', () => removeClient(ws));
  });

  startPolling(broadcast);

  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, () => {
    console.log('Server listening on http://localhost:' + port);
  });
});
