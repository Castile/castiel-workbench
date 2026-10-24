import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalStore } from '../desktop/store.mjs';
import { decodeDocument, encodeDocument } from '../src/state/document.js';
import { seedRecords, addRecords, presentRecords, updateRecord } from '../src/state/records.js';
import { PersistenceEngine } from '../src/state/engine.js';
import { assetPath } from '../desktop/assets.mjs';

const sample = name => ({ theme: 'dark', records: { tasks: [], sessions: [{ id: 'chat', taskId: null, title: name, agent: 'Codex', messages: [] }] }, spaces: [{ id: 'personal', name: '个人空间', path: '' }] });
async function fixture(t) { const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'castiel-store-test-')); t.after(() => fs.rm(directory, { recursive: true, force: true })); return new LocalStore(directory); }
test('state survives reopening, keeps backup, and uses private file permissions', async t => {
  const store = await fixture(t); assert.equal((await store.load()).revision, 0);
  await store.save(sample('first'), 0); await store.save(sample('second'), 1);
  const fresh = await new LocalStore(store.directory).load(); assert.equal(fresh.data.records.sessions[0].title, 'second');
  assert.equal((await store.read(store.backup)).data.records.sessions[0].title, 'first');
  assert.equal((await fs.stat(store.file)).mode & 0o777, 0o600);
});
test('simultaneous stale writes cannot replace a newer revision', async t => {
  const store = await fixture(t); await store.load();
  const results = await Promise.allSettled([store.save(sample('a'), 0), store.save(sample('b'), 0)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await store.load()).data.records.sessions[0].title, 'a');
});
test('corrupt primary loads backup read-only and restoration preserves corrupt evidence', async t => {
  const store = await fixture(t); await store.load(); await store.save(sample('first'), 0); await store.save(sample('second'), 1);
  await fs.writeFile(store.file, '{broken');
  const loaded = await store.load(); assert.equal(loaded.recovered, true); assert.equal(loaded.data.records.sessions[0].title, 'first');
  await assert.rejects(store.save(sample('overwrite'), loaded.revision), /恢复备份/);
  await store.restoreBackup(); assert.equal((await store.load()).recovered, false);
  assert.ok((await fs.readdir(store.directory)).some(name => name.includes('.corrupt-')));
});
test('no valid backup blocks startup without deleting or overwriting the primary', async t => {
  const store = await fixture(t); await store.load(); await fs.writeFile(store.file, 'bad data');
  await assert.rejects(store.load(), /阻止覆盖/); assert.equal(await fs.readFile(store.file, 'utf8'), 'bad data');
});
test('a newer schema cannot be silently replaced with an older backup', async t => {
  const store = await fixture(t); await store.load(); await store.save(sample('old'), 0); await store.save(sample('current'), 1);
  const future = JSON.parse(await fs.readFile(store.file, 'utf8')); future.schemaVersion = 2;
  await fs.writeFile(store.file, JSON.stringify(future));
  await assert.rejects(store.load(), /匹配版本/);
  assert.equal(JSON.parse(await fs.readFile(store.file, 'utf8')).schemaVersion, 2);
});
test('optional message metadata is omitted safely rather than breaking save', async t => {
  const store = await fixture(t); await store.load(); const data = sample('message');
  data.records.sessions[0].messages.push({ text: 'hello', attachment: undefined });
  await store.save(data, 0); assert.deepEqual((await store.load()).data.records.sessions[0].messages, [{ text: 'hello' }]);
});
test('export and import are validated and previous state remains recoverable', async t => {
  const store = await fixture(t); await store.load(); await store.save(sample('source'), 0);
  const file = path.join(store.directory, 'export.json'); await store.exportTo(file);
  await store.save(sample('changed'), 1); await store.importFrom(file, 2);
  assert.equal((await store.load()).data.records.sessions[0].title, 'source');
  assert.equal((await store.read(store.backup)).data.records.sessions[0].title, 'changed');
  await fs.writeFile(file, '{"format":"unknown"}'); await assert.rejects(store.importFrom(file, 3));
  assert.equal((await store.load()).revision, 3);
});
test('a failed atomic replacement retains last good state and cleans temporary files', async t => {
  const store = await fixture(t); await store.load(); await store.save(sample('good'), 0);
  const atomic = store.atomic.bind(store); store.atomic = async (file, text) => { if (file === store.file) throw new Error('simulated disk full'); return atomic(file, text); };
  await assert.rejects(store.save(sample('lost'), 1), /disk full/);
  assert.equal((await store.load()).data.records.sessions[0].title, 'good');
  assert.equal((await fs.readdir(store.directory)).some(name => name.endsWith('.tmp')), false);
});
test('unsaved edits can be exported without replacing the primary store', async t => {
  const store = await fixture(t); await store.load(); await store.save(sample('saved'), 0);
  const file = path.join(store.directory, 'rescue.json');
  await store.exportTo(file, { data: sample('unsaved'), revision: 1 });
  assert.equal((await store.read(file)).data.records.sessions[0].title, 'unsaved');
  assert.equal((await store.load()).data.records.sessions[0].title, 'saved');
  await assert.rejects(store.exportTo(store.file, { data: sample('overwrite'), revision: 0 }), /以外的位置/);
});
test('ordinary chats are independent of tasks, and renaming a linked session keeps task title', () => {
  let records = seedRecords([{ id: 'task', title: '工作任务', messages: [{ text: 'hello' }], agent: 'Codex' }]);
  records = addRecords(records, [{ id: 'chat', title: '普通问答', sessionKind: 'agent', workspaceId: 'personal', messages: [] }]);
  assert.equal(records.tasks.length, 1); assert.equal(records.sessions.length, 2);
  records = updateRecord(records, 'task', row => ({ ...row, title: '会话别名' }), true);
  assert.equal(records.tasks[0].title, '工作任务'); assert.equal(presentRecords(records)[0].title, '会话别名');
  records = updateRecord(records, 'chat', row => ({ ...row, messages: [{ text: 'saved' }] }));
  assert.equal(records.tasks.length, 1); assert.equal(records.sessions[1].messages[0].text, 'saved');
});
test('invalid relationships, duplicate IDs, unsupported versions and dangerous keys are rejected', () => {
  const invalid = sample('x'); invalid.records.sessions[0].taskId = 'missing'; assert.throws(() => encodeDocument(invalid));
  assert.throws(() => encodeDocument({ spaces: [{ id: 's', name: 'n', path: '', projectId: 'p' }] }));
  assert.throws(() => encodeDocument(JSON.parse('{"__proto__":{}}')));
  assert.throws(() => encodeDocument({ members: [] }));
  const collision = sample('collision'); collision.records.tasks.push({ id: 'chat', title: 'task' }); assert.throws(() => encodeDocument(collision));
  const text = JSON.parse(encodeDocument(sample('ok'))); text.schemaVersion = 999; assert.throws(() => decodeDocument(JSON.stringify(text)));
});
test('editing an unstarted task does not create a conversation', () => {
  let records = { tasks: [{ id: 'todo', title: 'before', status: '待规划' }], sessions: [] };
  records = updateRecord(records, 'todo', row => ({ ...row, title: 'after', status: '执行中' }));
  assert.equal(records.tasks[0].title, 'after'); assert.equal(records.sessions.length, 0);
  records = updateRecord(records, 'todo', row => ({ ...row, messages: [{ text: 'started' }] }));
  assert.equal(records.sessions.length, 1); assert.equal(records.sessions[0].taskId, 'todo');
});
test('save controller retains changes during an in-flight write and can retry after failure', async () => {
  let release, calls = 0, persisted;
  const api = { save: async data => { calls++; if (calls === 1) await new Promise(resolve => { release = resolve; }); persisted = data; return { revision: calls }; } };
  const engine = new PersistenceEngine(api); engine.set('theme', 'light'); const pending = engine.flush(); engine.set('theme', 'dark'); release(); await pending;
  assert.equal(persisted.theme, 'dark'); assert.equal(engine.status, 'saved');
  api.save = async () => { throw new Error('no space'); }; engine.set('theme', 'system'); await assert.rejects(engine.flush()); assert.equal(engine.status, 'error'); assert.equal(engine.dirty, true);
  api.save = async data => { persisted = data; return { revision: 3 }; }; await engine.flush(); assert.equal(persisted.theme, 'system'); assert.equal(engine.status, 'saved');
});
test('custom protocol cannot expose files outside the bundled renderer or another host', () => {
  assert.equal(assetPath('castiel://app/assets/app.js', '/bundle'), '/bundle/assets/app.js');
  assert.throws(() => assetPath('castiel://app/%2e%2e%2fsecret', '/bundle'));
  assert.throws(() => assetPath('castiel://other/index.html', '/bundle'));
  assert.throws(() => assetPath('https://app/index.html', '/bundle'));
});
