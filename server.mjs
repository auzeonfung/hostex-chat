import { createRequire } from 'module';
import http from 'http';
import { fileURLToPath } from 'url';

import { listConversations, listConversation, listMessages, listReadState, setReadState } from './backend/db.js';
import { addClient, removeClient, broadcast } from './backend/events.js';
import { startPolling, pollOnce } from './backend/poller.js';
import { getSetting } from './backend/db.js';

const frontendDir = fileURLToPath(new URL('./frontend', import.meta.url));
const requireFrontend = createRequire(new URL('./frontend/package.json', import.meta.url));
const requireBackend = createRequire(new URL('./backend/package.json', import.meta.url));
const { LocalStorage } = requireBackend('node-localstorage');
// Ensure tools like Tailwind CSS that rely on process.cwd() resolve the correct config
process.chdir(frontendDir);

const next = requireFrontend('next');
const express = requireBackend('express');
const cors = requireBackend('cors');
const { WebSocketServer } = requireBackend('ws');
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, dir: '.' });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const app = express();
  app.use(cors());
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

  app.post('/api/read-state', express.json(), async (req, res) => {
    const { conversationId, read } = req.body || {};
    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId required' });
    }
    setReadState(conversationId, !!read);
    res.json({ status: 'ok' });
  });

  // Provide a simple health check for the events endpoint used by the frontend
  app.get('/api/events', (_req, res) => res.sendStatus(200));

  app.all('*', (req, res) => handle(req, res));

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: '/api/events' });
  wss.on('connection', ws => {
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
  app.post('/api/poll-now', async (_req, res) => {
    await pollOnce(broadcast);
    res.json({ status: 'ok' });
  });

  startPolling(broadcast, interval);

  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, () => {
    console.log('Server listening on http://localhost:' + port);
  });
});
