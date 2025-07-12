const test = require('node:test');
const assert = require('assert');
const { spawn } = require('child_process');
const { once } = require('events');
const WebSocket = require('ws');
const net = require('net');
const os = require('os');
const path = require('path');

function getPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(err => (err ? reject(err) : resolve(port)));
    });
    srv.on('error', reject);
  });
}

test.skip('webhook delivers events via websocket', async (t) => {
  const port = await getPort();
  const dbPath = path.join(os.tmpdir(), `test-${port}.sqlite`);

  const env = { ...process.env, PORT: String(port), DB_PATH: dbPath, HOSTEX_API_TOKEN: 'dummy', NEXT_TELEMETRY_DISABLED: '1' };
  const server = spawn(process.execPath, ['server.mjs'], { env, stdio: ['ignore', 'pipe', 'inherit'] });

  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => {
      if (String(data).includes('Server listening')) resolve();
    });
    server.on('error', reject);
    server.on('exit', (code) => {
      if (code !== null && code !== 0) reject(new Error('server exited')); 
    });
  });

  const ws = new WebSocket(`ws://localhost:${port}/api/events`);
  await once(ws, 'open');

  const waitMsg = Promise.race([
    once(ws, 'message').then(([msg]) => msg.toString()),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
  ]);

  const payload = { type: 'message.created', data: { conversation_id: 'c1', text: 'hi' } };
  await fetch(`http://localhost:${port}/api/webhook/hostex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const message = JSON.parse(await waitMsg);
  assert.strictEqual(message.conversationId, 'c1');
  assert.deepStrictEqual(message.message, payload.data);

  ws.close();
  server.kill();
});
