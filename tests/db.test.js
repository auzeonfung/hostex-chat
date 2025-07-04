const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(process.cwd(), 'db.sqlite');
// remove existing db file
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = require('./build/db.js');

test('add and list replies', async () => {
  const reply = await db.addReply({ conversationId: '1', text: 'hello', model: 'm' });
  const list = await db.listReplies('1');
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].text, 'hello');
});

test('webhook events', async () => {
  await db.addWebhookEvent({ type: 'message.created', conversationId: '1', payload: {a:1} });
  const events = await db.listWebhookEvents('1');
  assert.strictEqual(events.length, 1);
  assert.deepStrictEqual(events[0].payload, {a:1});
});

test('openai logs', async () => {
  await db.addOpenAILog({ conversationId: '1', payload: {b:2} });
  const logs = await db.listOpenAILogs('1');
  assert.strictEqual(logs.length, 1);
  assert.deepStrictEqual(logs[0].payload, {b:2});
});

test('read state', async () => {
  await db.setReadState('1', true);
  const states = await db.listReadState();
  assert.strictEqual(states['1'], true);
  const partial = await db.getReadState(['1', '2']);
  assert.strictEqual(partial['1'], true);
});

test('settings CRUD', async () => {
  const setting = await db.addSetting('demo', {x:1}, 5);
  let fetched = await db.getSetting(setting.id);
  assert.strictEqual(fetched.name, 'demo');
  assert.deepStrictEqual(fetched.data, {x:1});
  assert.strictEqual(fetched.pollInterval, 5);
  await db.updateSetting(setting.id, 'demo2', {x:2}, 0);
  fetched = await db.getSetting(setting.id);
  assert.strictEqual(fetched.name, 'demo2');
  assert.deepStrictEqual(fetched.data, {x:2});
  assert.strictEqual(fetched.pollInterval, 0);
  const list = await db.listSettings();
  assert.ok(list.find(s => s.id === setting.id));
  await db.deleteSetting(setting.id);
  fetched = await db.getSetting(setting.id);
  assert.strictEqual(fetched, undefined);
});

