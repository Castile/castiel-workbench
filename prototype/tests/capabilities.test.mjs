import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { CapabilityManager } from '../desktop/capabilities.mjs';
async function fixture(t) {
  const home = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'castiel-capabilities-')));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const workspace = path.join(home, 'workspace'), directory = path.join(home, 'workbench');
  await fs.mkdir(workspace); await fs.mkdir(directory);
  const store = { directory, file: path.join(directory, 'workbench.json'), read: async () => ({ data: { spaces: [{ id: 'space', path: workspace }] } }) };
  const state = { skills: [], mcp: {}, calls: [] };
  const runtime = { home, env: { HOME: home, TOKEN: 'secret-value-123' }, redactionEnv: { TOKEN: 'secret-value-123' }, active: () => [], catalog: { agents: { Claude: { installed: true, executable: '/fixture/claude' }, Codex: { installed: true, executable: '/fixture/codex' } } } };
  runtime.rpc = { request: async (method, params) => {
    state.calls.push({ method, params });
    if (method === 'skills/list') return { data: [{ cwd: workspace, skills: state.skills, errors: [] }] };
    if (method === 'skills/config/write') { state.skills.find(s => s.path === params.path).enabled = params.enabled; return {}; }
    if (method === 'config/read') return { config: { mcp_servers: state.mcp }, origins: Object.fromEntries(Object.keys(state.mcp).map(n => ['mcp_servers.' + n, { name: { type: 'user', file: path.join(home, '.codex/config.toml') }, version: 'v1' }])), layers: [{ name: { type: 'user', file: path.join(home, '.codex/config.toml') }, version: 'v1', config: { mcp_servers: state.mcp } }] };
    if (method === 'config/value/write') { const n = params.keyPath.split('.')[1]; if (params.keyPath.endsWith('.enabled')) state.mcp[n].enabled = params.value; else state.mcp[n] = params.value; return {}; }
    throw new Error('unexpected RPC ' + method);
  } };
  let selected;
  const dialog = { showOpenDialog: async () => selected ? { canceled: false, filePaths: [selected] } : { canceled: true, filePaths: [] } };
  const command = async (_executable, args) => {
    assert.equal(args[0], 'mcp');
    const file = path.join(home, '.claude.json'), config = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => ({}));
    if (args[1] === 'add-json') { config.mcpServers ||= {}; config.mcpServers[args[2]] = JSON.parse(args[3]); }
    else if (args[1] === 'remove') delete config.mcpServers[args[2]];
    else throw new Error('unsupported native command');
    await fs.writeFile(file, JSON.stringify(config)); return '';
  };
  return { home, workspace, store, runtime, state, manager: new CapabilityManager({ store, runtime, dialog, home, command, managedDirectories: [] }), select: value => { selected = value; } };
}
async function skill(root, name, body = 'Instructions') { const dir = path.join(root, name); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: Useful local skill\n---\n${body}`); return dir; }
const args = { agent: 'Claude', workspaceId: 'space' };

test('Claude discovery reflects real deny settings and never returns MCP credentials', async t => {
  const f = await fixture(t);
  await skill(path.join(f.home, '.claude/skills'), 'deploy');
  await fs.writeFile(path.join(f.home, '.claude/settings.json'), JSON.stringify({ permissions: { deny: ['Skill(deploy *)'] } }));
  await fs.writeFile(path.join(f.home, '.claude.json'), JSON.stringify({ mcpServers: { private: { type: 'http', url: 'https://user:pass@example.com/secret-token?token=secret-value-123', headers: { Authorization: 'Bearer hidden123' } } } }));
  const value = await f.manager.listCapabilities(args);
  assert.equal(value.skills[0].enabled, false);
  assert.equal(value.skills[0].removable, false);
  assert.equal(value.mcp[0].endpoint, 'https://example.com');
  assert.doesNotMatch(JSON.stringify(value), /secret-value|hidden123|user:pass|secret-token|Authorization/);
});
test('skill toggle preserves other settings and its prior version backup', async t => {
  const f = await fixture(t);
  await skill(path.join(f.home, '.claude/skills'), 'deploy');
  const file = path.join(f.home, '.claude/settings.json');
  await fs.writeFile(file, JSON.stringify({ model: 'sonnet', permissions: { allow: ['Read'] } }));
  const item = (await f.manager.listCapabilities(args)).skills[0];
  const off = await f.manager.manageCapability({ ...args, kind: 'skill', action: 'toggle', id: item.id, enabled: false });
  assert.equal(off.skills[0].enabled, false);
  const config = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(config.model, 'sonnet'); assert.deepEqual(config.permissions.allow, ['Read']);
  assert.ok(config.permissions.deny.includes('Skill(deploy *)'));
  assert.equal(JSON.parse(await fs.readFile(file + '.castiel.bak', 'utf8')).model, 'sonnet');
  assert.equal((await f.manager.manageCapability({ ...args, kind: 'skill', action: 'toggle', id: item.id, enabled: true })).skills[0].enabled, true);
});
test('inherited skill denial cannot falsely become enabled', async t => {
  const f = await fixture(t);
  await skill(path.join(f.home, '.claude/skills'), 'deploy');
  await fs.mkdir(path.join(f.workspace, '.claude')); await fs.writeFile(path.join(f.workspace, '.claude/settings.json'), JSON.stringify({ permissions: { deny: ['Skill'] } }));
  const item = (await f.manager.listCapabilities(args)).skills[0];
  assert.equal(item.enabled, false); assert.equal(item.toggleable, false);
  await assert.rejects(f.manager.manageCapability({ ...args, kind: 'skill', action: 'toggle', id: item.id, enabled: true }));
});
test('imports copy native user skills without overwrite and only owned imports are removable', async t => {
  const f = await fixture(t);
  const source = await skill(path.join(f.home, 'chosen'), 'local-skill'); f.select(source);
  const catalog = await f.manager.manageCapability({ ...args, kind: 'skill', action: 'import' });
  const item = catalog.skills.find(s => s.name === 'local-skill'); assert.equal(item.removable, true);
  assert.match((await f.manager.manageCapability({ ...args, kind: 'skill', action: 'read', id: item.id })).text, /Instructions/);
  await assert.rejects(f.manager.manageCapability({ ...args, kind: 'skill', action: 'import' }));
  const removed = await f.manager.manageCapability({ ...args, kind: 'skill', action: 'remove', id: item.id });
  assert.equal(removed.skills.length, 0);
  const backups = await fs.readdir(path.join(f.store.directory, 'capability-backups')); assert.equal(backups.length, 1);
  assert.match(await fs.readFile(path.join(f.store.directory, 'capability-backups', backups[0], 'SKILL.md'), 'utf8'), /Instructions/);
});
test('imports reject symlinks and hidden files without installing partial data', async t => {
  const f = await fixture(t);
  const source = await skill(path.join(f.home, 'chosen'), 'unsafe');
  await fs.symlink('/etc/passwd', path.join(source, 'escape')); f.select(source);
  await assert.rejects(f.manager.manageCapability({ ...args, kind: 'skill', action: 'import' }));
  assert.deepEqual((await f.manager.listCapabilities(args)).skills, []);
  await fs.unlink(path.join(source, 'escape')); await fs.writeFile(path.join(source, '.env'), 'TOKEN=secret');
  await assert.rejects(f.manager.manageCapability({ ...args, kind: 'skill', action: 'import' }));
});
test('unknown source ids, renderer paths and busy mutations are rejected', async t => {
  const f = await fixture(t);
  await assert.rejects(f.manager.listCapabilities({ agent: 'Claude', workspaceId: '../../other' }));
  await assert.rejects(f.manager.manageCapability({ ...args, kind: 'skill', action: 'read', id: '/etc/passwd' }));
  await assert.rejects(f.manager.manageCapability({ ...args, kind: 'skill', action: 'import', path: f.home }));
  f.runtime.active = () => [{ status: 'running' }];
  await assert.rejects(f.manager.manageCapability({ ...args, kind: 'mcp', action: 'add', server: { name: 'x', transport: 'http', url: 'https://example.com' } }));
});
test('Claude MCP add uses user scope and toggle persists only for the chosen workspace', async t => {
  const f = await fixture(t);
  let catalog = await f.manager.manageCapability({ ...args, kind: 'mcp', action: 'add', server: { name: 'docs', transport: 'stdio', command: 'node', args: ['server.js'], envKeys: ['DOCS_TOKEN'] } });
  const config = JSON.parse(await fs.readFile(path.join(f.home, '.claude.json'), 'utf8'));
  assert.deepEqual(config.mcpServers.docs.env, { DOCS_TOKEN: '${DOCS_TOKEN}' });
  assert.equal(catalog.mcp[0].scope, 'user');
  catalog = await f.manager.manageCapability({ ...args, kind: 'mcp', action: 'toggle', id: catalog.mcp[0].id, enabled: false });
  assert.equal(catalog.mcp[0].enabled, false);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.home, '.claude.json'), 'utf8')).projects[f.workspace].disabledMcpServers, ['docs']);
});
test('Codex native metadata determines skills and user MCP writes use versioned config API', async t => {
  const f = await fixture(t);
  const dir = await skill(path.join(f.home, '.agents/skills'), 'build');
  f.state.skills = [{ name: 'build', description: 'Build things', path: path.join(dir, 'SKILL.md'), scope: 'user', enabled: true }];
  f.state.mcp = { docs: { url: 'https://example.com/private?api_key=x', enabled: true, http_headers: { Authorization: 'secret' } } };
  const context = { agent: 'Codex', workspaceId: 'space' };
  const catalog = await f.manager.listCapabilities(context);
  assert.equal(catalog.skills[0].enabled, true); assert.equal(catalog.mcp[0].endpoint, 'https://example.com');
  assert.equal((await f.manager.manageCapability({ ...context, kind: 'skill', action: 'toggle', id: catalog.skills[0].id, enabled: false })).skills[0].enabled, false);
  assert.equal((await f.manager.manageCapability({ ...context, kind: 'mcp', action: 'toggle', id: catalog.mcp[0].id, enabled: false })).mcp[0].enabled, false);
  const write = f.state.calls.find(c => c.method === 'config/value/write');
  assert.equal(write.params.keyPath, 'mcp_servers.docs.enabled'); assert.equal(write.params.expectedVersion, 'v1');
});
test('MCP submission rejects inline credentials and ambiguous server names', async t => {
  const f = await fixture(t);
  for (const server of [{ name: 'bad.name', transport: 'http', url: 'https://example.com' }, { name: 'docs', transport: 'http', url: 'https://user:pass@example.com' }, { name: 'docs', transport: 'stdio', command: 'node', args: ['--token=secret-value'], envKeys: ['TOKEN=value'] }]) {
    await assert.rejects(f.manager.manageCapability({ ...args, kind: 'mcp', action: 'add', server }));
  }
});

test('native JSON writes reject symlink files and never overwrite their targets', async t => {
  const f = await fixture(t);
  await skill(path.join(f.home, '.claude/skills'), 'deploy');
  const unrelated = path.join(f.home, 'unrelated.json'); await fs.writeFile(unrelated, '{"keep":true}');
  const item = (await f.manager.listCapabilities(args)).skills[0];
  await fs.symlink(unrelated, path.join(f.home, '.claude/settings.json'));
  await assert.rejects(f.manager.manageCapability({ ...args, kind: 'skill', action: 'toggle', id: item.id, enabled: false }));
  assert.equal(await fs.readFile(unrelated, 'utf8'), '{"keep":true}');
});

test('a mutation owns the runtime lock across a native dialog and rejects overlapping mutations', async t => {
  const f = await fixture(t);
  let cancel; f.manager.dialog.showOpenDialog = () => new Promise(resolve => { cancel = () => resolve({ canceled: true }); });
  const importing = f.manager.manageCapability({ ...args, kind: 'skill', action: 'import' });
  while (!cancel) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(f.runtime.capabilitiesBusy, true);
  await assert.rejects(f.manager.manageCapability({ ...args, kind: 'mcp', action: 'add', server: { name: 'x', transport: 'http', url: 'https://example.com' } }));
  cancel(); assert.equal((await importing).canceled, true); assert.equal(f.runtime.capabilitiesBusy, false);
});

test('MCP failures do not reveal raw native command diagnostics', async t => {
  const f = await fixture(t);
  f.manager.command = async () => { throw new Error('https://user:unknown-secret@example.com/token?token=never-render-this'); };
  await assert.rejects(f.manager.manageCapability({ ...args, kind: 'mcp', action: 'add', server: { name: 'docs', transport: 'http', url: 'https://example.com' } }), error => !/unknown-secret|never-render-this|user:/.test(error.message));
  assert.equal(f.runtime.capabilitiesBusy, false);
});

test('project MCP awaiting native approval is reported disabled and cannot be edited', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.workspace, '.mcp.json'), JSON.stringify({ mcpServers: { docs: { type: 'http', url: 'https://example.com' } } }));
  const item = (await f.manager.listCapabilities(args)).mcp[0];
  assert.equal(item.enabled, false); assert.equal(item.editable, false); assert.match(item.status, /批准/);
});

test('MCP names shadowed by another scope never offer an unsafe toggle', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.home, '.claude.json'), JSON.stringify({ mcpServers: { docs: { type: 'http', url: 'https://user.example' } }, projects: { [f.workspace]: { mcpServers: { docs: { type: 'http', url: 'https://local.example' } } } } }));
  const items = (await f.manager.listCapabilities(args)).mcp;
  assert.equal(items.find(i => i.scope === 'user').enabled, false);
  assert.equal(items.find(i => i.scope === 'user').editable, false);
  assert.equal(items.find(i => i.scope === 'local').enabled, true);
});

test('managed permission policy does not claim user Skill rules will take effect', async t => {
  const f = await fixture(t);
  await skill(path.join(f.home, '.claude/skills'), 'deploy');
  const managed = path.join(f.home, 'managed'); await fs.mkdir(managed); f.manager.managedDirectories = [managed];
  await fs.writeFile(path.join(managed, 'managed-settings.json'), JSON.stringify({ allowManagedPermissionRulesOnly: true }));
  assert.equal((await f.manager.listCapabilities(args)).skills[0].toggleable, false);
});

test('native APIs that do not persist a toggle cannot report mutation success', async t => {
  const f = await fixture(t);
  const dir = await skill(path.join(f.home, '.agents/skills'), 'build');
  f.state.skills = [{ name: 'build', description: 'Build', path: path.join(dir, 'SKILL.md'), scope: 'user', enabled: true }];
  const request = f.runtime.rpc.request; f.runtime.rpc.request = (method, params) => method === 'skills/config/write' ? Promise.resolve({}) : request(method, params);
  const context = { agent: 'Codex', workspaceId: 'space' }, item = (await f.manager.listCapabilities(context)).skills[0];
  await assert.rejects(f.manager.manageCapability({ ...context, kind: 'skill', action: 'toggle', id: item.id, enabled: false }));
});

test('custom Claude config roots resolve native user state consistently', async t => {
  const f = await fixture(t);
  f.runtime.env.CLAUDE_CONFIG_DIR = path.join(f.home, 'custom-claude'); await fs.mkdir(f.runtime.env.CLAUDE_CONFIG_DIR);
  await fs.writeFile(path.join(f.runtime.env.CLAUDE_CONFIG_DIR, '.claude.json'), JSON.stringify({ mcpServers: { docs: { type: 'http', url: 'https://example.com' } } }));
  assert.equal((await f.manager.listCapabilities(args)).mcp[0].name, 'docs');
});

test('registered plugin skills and MCP remain readable with honest plugin scope and inactive status', async t => {
  const f = await fixture(t), plugin = path.join(f.home, 'plugin');
  await skill(path.join(plugin, 'skills'), 'inspect'); await fs.mkdir(path.join(plugin, '.claude-plugin'));
  await fs.writeFile(path.join(plugin, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'local-tools' }));
  await fs.writeFile(path.join(plugin, '.mcp.json'), JSON.stringify({ docs: { type: 'http', url: 'https://example.com/private?token=hidden' } }));
  await fs.mkdir(path.join(f.home, '.claude/plugins'), { recursive: true });
  await fs.writeFile(path.join(f.home, '.claude/plugins/installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'local-tools@fixture': [{ scope: 'user', installPath: plugin }] } }));
  await fs.writeFile(path.join(f.home, '.claude/settings.json'), JSON.stringify({ enabledPlugins: { 'local-tools@fixture': false } }));
  const catalog = await f.manager.listCapabilities(args), item = catalog.skills.find(s => s.name === 'local-tools:inspect');
  assert.equal(item.scope, 'plugin'); assert.equal(item.enabled, false); assert.equal(item.removable, false); assert.equal(item.toggleable, false);
  assert.equal(catalog.mcp[0].scope, 'plugin'); assert.equal(catalog.mcp[0].enabled, false); assert.equal(catalog.mcp[0].editable, false);
  assert.match((await f.manager.manageCapability({ ...args, kind: 'skill', action: 'read', id: item.id })).text, /Instructions/);
});

test('import rejects an oversized supporting file before creating native installation', async t => {
  const f = await fixture(t), source = await skill(path.join(f.home, 'chosen'), 'large'); f.select(source);
  await fs.writeFile(path.join(source, 'large.bin'), Buffer.alloc(2 * 1024 * 1024 + 1));
  await assert.rejects(f.manager.manageCapability({ ...args, kind: 'skill', action: 'import' }));
  await assert.rejects(fs.access(path.join(f.home, '.claude/skills/large')));
});
