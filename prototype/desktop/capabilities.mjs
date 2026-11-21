import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { command as nativeCommand } from './discovery.mjs';

const MAX_CONFIG = 2 * 1024 * 1024, MAX_SKILL = 256 * 1024;
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const SKILL_NAME = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,149}$/;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const idFor = (...values) => createHash('sha256').update(values.join('\0')).digest('hex');
class CapabilityError extends Error {}
function fail(message) { throw new CapabilityError(message); }
function within(root, file) { const relative = path.relative(root, file); return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }
async function exists(file) { try { await fs.lstat(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
async function canonicalDirectory(directory) {
  try { return await fs.realpath(directory); }
  catch (e) { if (e.code !== 'ENOENT') throw e; return path.join(await canonicalDirectory(path.dirname(directory)), path.basename(directory)); }
}
async function boundedBytes(handle, limit) {
  const chunks = []; let total = 0;
  while (total <= limit) {
    const bytes = Buffer.alloc(Math.min(65536, limit + 1 - total)), result = await handle.read(bytes, 0, bytes.length, null);
    if (!result.bytesRead) return Buffer.concat(chunks, total);
    total += result.bytesRead; if (total > limit) fail('本机能力文件超过大小限制'); chunks.push(bytes.subarray(0, result.bytesRead));
  }
  fail('本机能力文件超过大小限制');
}
async function textFile(file, limit = MAX_CONFIG) {
  // Never follow a SKILL.md or configuration file that is itself a symlink.
  if ((await fs.lstat(file)).isSymbolicLink()) fail('本机能力文件包含符号链接，已阻止读取');
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try { const stat = await handle.stat(); if (!stat.isFile() || stat.size > limit) fail('本机能力文件无效或超过大小限制'); return (await boundedBytes(handle, limit)).toString('utf8'); }
  finally { await handle.close(); }
}
async function jsonFile(file) {
  try { const value = JSON.parse(await textFile(file)); if (!object(value)) fail('本机配置格式无效'); return value; }
  catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
}
async function atomic(file, text) {
  const temporary = file + '.' + randomUUID() + '.tmp'; let handle;
  try {
    handle = await fs.open(temporary, 'wx', 0o600); await handle.writeFile(text, 'utf8'); await handle.sync(); await handle.close(); handle = null;
    await fs.rename(temporary, file);
    // Windows supports flushing the temporary file, but not opening its parent for fsync.
    if (process.platform !== 'win32') {
      const directory = await fs.open(path.dirname(file), 'r'); try { await directory.sync(); } finally { await directory.close(); }
    }
  } finally { await handle?.close(); await fs.unlink(temporary).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
}
function endpoint(server) {
  if (typeof server.url === 'string') { try { const url = new URL(server.url); return ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) ? url.origin : '远程端点'; } catch { return '远程端点（含变量或未配置）'; } }
  const executable = path.basename(String(server.command || '')); return /^[A-Za-z0-9_.-]{1,100}$/.test(executable) ? executable : '本机命令';
}
function frontmatter(text, fallback) {
  const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] || '';
  const field = key => block.match(new RegExp('^' + key + ':\\s*(.+)$', 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  const name = field('name');
  return { name: SKILL_NAME.test(name || '') ? name : fallback, description: field('description') || '本机 Skill；详情见 SKILL.md' };
}
function denial(rule, name) {
  if (['Skill', 'Skill(*)', '*'].includes(rule)) return true;
  const match = typeof rule === 'string' && rule.match(/^Skill\(([^)]+)\)$/); if (!match) return false;
  const pattern = match[1].replace(/ \*$/, '');
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$').test(name);
}

/** Native config management only: listing never starts MCP processes or model requests. */
export class CapabilityManager {
  constructor({ store, runtime, dialog, home = runtime?.home || os.homedir(), command = nativeCommand, managedDirectories }) {
    this.store = store; this.runtime = runtime; this.dialog = dialog; this.home = home; this.command = command;
    this.managedDirectories = managedDirectories || (process.platform === 'darwin' ? ['/Library/Application Support/ClaudeCode'] : process.platform === 'win32' ? [path.join(process.env.ProgramFiles || 'C:/Program Files', 'ClaudeCode')] : ['/etc/claude-code']);
    this.manifestFile = path.join(store.directory, 'capability-imports.json'); this.busy = false;
  }
  clean(value, limit = 500) {
    let text = String(value || '');
    for (const [key, secret] of Object.entries({ ...this.runtime.env, ...this.runtime.redactionEnv, ...this.secrets })) if (/(TOKEN|KEY|SECRET|PASSWORD)/i.test(key) && typeof secret === 'string' && secret.length >= 6) text = text.split(secret).join('[已隐藏凭据]');
    return text.replace(/\b(?:sk-[\w-]{8,}|Bearer\s+[A-Za-z0-9._~+/-]{8,})/g, '[已隐藏凭据]').slice(0, limit);
  }
  error(error) { return new Error(error instanceof CapabilityError ? this.clean(error.message) : '本机能力配置操作失败；请检查原工具配置或重新检测后重试'); }
  async context(args) {
    if (!object(args) || !['Codex', 'Claude'].includes(args.agent)) fail('无效的 Agent');
    if (Object.keys(args).some(key => !['agent', 'workspaceId', 'kind', 'action', 'id', 'enabled', 'server'].includes(key))) fail('无效的能力请求字段');
    if (typeof args.workspaceId !== 'string' || args.workspaceId.length > 150) fail('请选择已保存的工作空间');
    if (this.runtime.detecting) await this.runtime.detecting;
    const tool = this.runtime.catalog?.agents?.[args.agent]; if (!tool?.installed) fail('此 Agent 尚未安装，请先重新检测');
    this.home = await fs.realpath(this.home); this.directory = await fs.realpath(this.store.directory); this.manifestFile = path.join(this.directory, 'capability-imports.json');
    const data = (await this.store.read(this.store.file)).data;
    const scope = data.spaces?.find(space => space.id === args.workspaceId); if (!scope) fail('工作空间不存在，请重新选择');
    let cwd = scope.path;
    if (!cwd) {
      const folder = /^[A-Za-z0-9_-]{1,80}$/.test(scope.id) ? scope.id : idFor(String(scope.id)).slice(0, 24);
      cwd = path.join(this.directory, 'workspaces', folder); await fs.mkdir(cwd, { recursive: true, mode: 0o700 });
    }
    if (!path.isAbsolute(cwd) || !(await fs.stat(cwd)).isDirectory()) fail('工作空间目录不存在');
    cwd = await fs.realpath(cwd);
    const env = this.runtime.env || {};
    let codexHome = env.CODEX_HOME || path.join(this.home, '.codex'), claudeHome = env.CLAUDE_CONFIG_DIR || path.join(this.home, '.claude');
    if (![codexHome, claudeHome].every(path.isAbsolute)) fail('本机配置目录必须为绝对路径');
    codexHome = await canonicalDirectory(codexHome); claudeHome = await canonicalDirectory(claudeHome);
    return { agent: args.agent, cwd, tool, codexHome, claudeHome, claudeState: env.CLAUDE_CONFIG_DIR ? path.join(claudeHome, '.claude.json') : path.join(this.home, '.claude.json') };
  }
  async listCapabilities(args) { try { return (await this.catalog(await this.context(args))).value; } catch (e) { throw this.error(e); } }
  async manifest() { const value = await jsonFile(this.manifestFile); return Array.isArray(value.imports) ? value.imports : []; }
  async owned(agent, file, manifest) {
    const folder = path.dirname(file), match = manifest.find(entry => entry.agent === agent && entry.path === folder && typeof entry.token === 'string');
    if (!match || (await fs.lstat(folder)).isSymbolicLink()) return false;
    const marker = await jsonFile(path.join(folder, '.castiel-import.json')).catch(() => ({})); return marker.token === match.token;
  }
  async catalog(ctx) {
    const value = { skills: [], mcp: [], warnings: [] }, entries = new Map(), manifest = await this.manifest();
    const skill = async (metadata, details = {}) => {
      if (value.skills.length >= 2000 || typeof metadata.path !== 'string' || !path.isAbsolute(metadata.path) || path.basename(metadata.path) !== 'SKILL.md') return;
      const id = idFor(ctx.agent, 'skill', metadata.path, metadata.name), removable = await this.owned(ctx.agent, metadata.path, manifest).catch(() => false);
      const item = { id, name: this.clean(metadata.name, 150), description: this.clean(metadata.description), path: this.clean(metadata.path, 1500), scope: metadata.scope, enabled: metadata.enabled === true, removable, toggleable: details.toggleable !== false, toggleScope: 'user', source: this.clean(details.source || metadata.scope, 300) };
      value.skills.push(item); entries.set(id, { kind: 'skill', ...metadata, ...details, removable, id });
    };
    const mcp = (name, config, details) => {
      if (!object(config) || value.mcp.length >= 500) return;
      const id = idFor(ctx.agent, 'mcp', details.file, details.scope, name);
      const item = { id, name: this.clean(name, 150), transport: this.clean(config.type || (config.url ? 'http' : 'stdio'), 30), endpoint: this.clean(endpoint(config), 300), scope: details.scope, enabled: details.enabled ?? config.enabled !== false, editable: details.editable === true, toggleScope: ctx.agent === 'Claude' ? 'workspace' : 'user', source: this.clean(details.file, 1500), ...(details.status ? { status: details.status } : {}) };
      value.mcp.push(item); entries.set(id, { kind: 'mcp', name, config, ...details, id });
    };
    if (ctx.agent === 'Codex') {
      if (!this.runtime.rpc) fail('Codex 配置连接不可用，请重新检测');
      const result = await this.runtime.rpc.request('skills/list', { cwds: [ctx.cwd], forceReload: true });
      for (const row of result.data || []) {
        if (row.errors?.length) value.warnings.push('部分 Codex Skills 无法解析，请在原工具中检查。');
        for (const item of row.skills || []) await skill(item, { source: item.pluginId ? '插件 · ' + item.pluginId : item.scope, toggleable: !['system', 'admin'].includes(item.scope) });
      }
      const response = await this.runtime.rpc.request('config/read', { cwd: ctx.cwd, includeLayers: true });
      const configFile = path.join(ctx.codexHome, 'config.toml');
      for (const [name, config] of Object.entries(response.config?.mcp_servers || {})) {
        const origins = Object.entries(response.origins || {}).filter(([key]) => key === 'mcp_servers' || key === 'mcp_servers.' + name || key.startsWith('mcp_servers.' + name + '.')).sort((a, b) => b[0].length - a[0].length).map(([, value]) => value);
        const origin = origins.find(value => value.name?.type !== 'user') || origins[0];
        const layer = origin || (response.layers || []).find(l => l.name?.type === 'user' && Object.hasOwn(l.config?.mcp_servers || {}, name));
        const file = layer?.name?.file || layer?.name?.dotCodexFolder || 'Codex 有效配置（来源未确认）';
        const editable = NAME.test(name) && layer?.name?.type === 'user' && !layer.name.profile && path.resolve(file) === path.resolve(configFile);
        mcp(name, config, { file, scope: layer?.name?.type || 'managed', editable, version: layer?.version });
      }
      ctx.configResponse = response;
      value.warnings.push('MCP 仅显示配置，尚未测试连接；托管、插件与工作空间来源只读。');
    } else {
      const settingsFiles = [path.join(ctx.claudeHome, 'settings.json')];
      let ancestor = ctx.cwd;
      while (true) { settingsFiles.push(path.join(ancestor, '.claude/settings.json'), path.join(ancestor, '.claude/settings.local.json')); const parent = path.dirname(ancestor); if (parent === ancestor) break; ancestor = parent; }
      for (const managed of this.managedDirectories) settingsFiles.push(path.join(managed, 'managed-settings.json'));
      const settings = [];
      for (const file of [...new Set(settingsFiles)]) { const config = await jsonFile(file); settings.push({ file, config }); this.secrets = { ...this.secrets, ...config.env }; }
      const managedRulesOnly = settings.some(s => this.managedDirectories.some(dir => s.file === path.join(dir, 'managed-settings.json')) && s.config.allowManagedPermissionRulesOnly === true);
      const ruleSources = managedRulesOnly ? settings.filter(s => this.managedDirectories.some(dir => s.file === path.join(dir, 'managed-settings.json'))) : settings;
      const denied = name => ruleSources.some(s => (s.config.permissions?.deny || []).some(rule => denial(rule, name)));
      const inheritedDeny = name => settings.some(s => s.file !== settingsFiles[0] && (s.config.permissions?.deny || []).some(rule => denial(rule, name)));
      const userDeny = settings[0].config.permissions?.deny || [];
      const addDirectory = async (root, scope, prefix = '', active = true) => {
        let folders; try { folders = await fs.readdir(root, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
        for (const folder of folders.slice(0, 2000)) {
          if (folder.name.startsWith('.') || (!folder.isDirectory() && !folder.isSymbolicLink())) continue;
          const file = path.join(root, folder.name, 'SKILL.md');
          try {
            const meta = frontmatter(await textFile(file, MAX_SKILL), folder.name), name = prefix + meta.name;
            const specific = ['Skill(' + name + ')', 'Skill(' + name + ' *)'];
            const broadDeny = userDeny.some(rule => denial(rule, name) && !specific.includes(rule));
            await skill({ ...meta, name, path: file, scope, enabled: active && !denied(name) }, { source: root, toggleable: active && scope !== 'managed' && !managedRulesOnly && SKILL_NAME.test(name) && !inheritedDeny(name) && !broadDeny });
          } catch (e) { if (e.code !== 'ENOENT') value.warnings.push('部分 Claude Skills 无法读取，已略过无效文件。'); }
        }
      };
      await addDirectory(path.join(ctx.claudeHome, 'skills'), 'user');
      ancestor = ctx.cwd;
      while (true) { await addDirectory(path.join(ancestor, '.claude/skills'), 'workspace'); const parent = path.dirname(ancestor); if (parent === ancestor) break; ancestor = parent; }
      for (const managed of this.managedDirectories) await addDirectory(path.join(managed, '.claude/skills'), 'managed');
      const state = await jsonFile(ctx.claudeState), local = state.projects?.[ctx.cwd] || {}, disabled = new Set(local.disabledMcpServers || []);
      for (const [name, config] of Object.entries(state.mcpServers || {})) mcp(name, config, { file: ctx.claudeState, scope: 'user', enabled: !disabled.has(name), editable: NAME.test(name) });
      for (const [name, config] of Object.entries(local.mcpServers || {})) mcp(name, config, { file: ctx.claudeState, scope: 'local', enabled: !disabled.has(name), editable: false });
      const projectFile = path.join(ctx.cwd, '.mcp.json'), project = await jsonFile(projectFile);
      for (const [name, config] of Object.entries(project.mcpServers || {})) {
        const approved = (local.enabledMcpjsonServers || []).includes(name) || settings.some(s => s.config.enableAllProjectMcpServers === true || (s.config.enabledMcpjsonServers || []).includes(name));
        const enabled = approved && !disabled.has(name) && !(local.disabledMcpjsonServers || []).includes(name) && !settings.some(s => (s.config.disabledMcpjsonServers || []).includes(name));
        mcp(name, config, { file: projectFile, scope: 'workspace', enabled, editable: false, ...(!approved ? { status: '待原工具批准' } : {}) });
      }
      const enabledPlugins = Object.assign({}, ...settings.map(s => s.config.enabledPlugins || {}));
      const registry = await jsonFile(path.join(ctx.claudeHome, 'plugins/installed_plugins.json'));
      for (const [pluginId, installs] of Object.entries(registry.plugins || {}).slice(0, 300)) for (const install of (Array.isArray(installs) ? installs : [])) {
        if (!path.isAbsolute(install.installPath || '') || (install.projectPath && !within(install.projectPath, ctx.cwd))) continue;
        const root = install.installPath, descriptor = await jsonFile(path.join(root, '.claude-plugin/plugin.json')), pluginName = descriptor.name || pluginId.split('@')[0], active = enabledPlugins[pluginId] !== false;
        if (!NAME.test(pluginName)) continue;
        await addDirectory(path.join(root, 'skills'), 'plugin', pluginName + ':', active);
        const pluginMcp = await jsonFile(path.join(root, '.mcp.json'));
        for (const [name, config] of Object.entries(pluginMcp.mcpServers || pluginMcp)) { const fullName = 'plugin:' + pluginName + ':' + name; mcp(fullName, config, { file: path.join(root, '.mcp.json'), scope: 'plugin', enabled: active && !disabled.has(fullName), editable: false }); }
      }
      for (const managed of this.managedDirectories) {
        const config = settings.find(s => s.file === path.join(managed, 'managed-settings.json'))?.config;
        for (const [name, server] of Object.entries(config?.managedMcpServers || config?.mcpServers || {})) mcp(name, server, { file: path.join(managed, 'managed-settings.json'), scope: 'managed', enabled: !disabled.has(name), editable: false });
      }
      const priority = { managed: 5, local: 4, workspace: 3, user: 2, plugin: 1 };
      for (const item of value.mcp) {
        const duplicates = value.mcp.filter(other => other.name === item.name);
        if (duplicates.length > 1) {
          item.editable = false; entries.get(item.id).editable = false;
          if (duplicates.some(other => priority[other.scope] > priority[item.scope])) { item.enabled = false; item.status = '被更高优先级来源覆盖'; }
          value.warnings.push('存在同名 MCP 的多个来源，请在原工具中消除冲突后再编辑。');
        }
      }
      if (managedRulesOnly) value.warnings.push('托管策略仅允许托管权限规则，用户级 Skill 开关不可修改。');
      value.warnings.push('Claude Skill 开关写入用户级权限规则，按名称影响所有工作空间；MCP 开关仅影响当前工作空间。', 'MCP 仅显示配置，尚未测试连接；空间、插件和托管来源只读。');
    }
    value.warnings = [...new Set(value.warnings)]; return { value, entries };
  }
  async writable(file) {
    const parent = path.dirname(file); await fs.mkdir(parent, { recursive: true, mode: 0o700 });
    if (path.resolve(parent) !== await fs.realpath(parent)) fail('配置目录包含符号链接，请在原工具中管理');
    if (await exists(file)) { const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_CONFIG) fail('配置文件不可安全修改'); }
  }
  async backup(file) { await this.writable(file); if (await exists(file)) await atomic(file + '.castiel.bak', await textFile(file)); }
  async editJSON(file, change) {
    await this.writable(file);
    const before = await textFile(file).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    const value = before === null ? {} : JSON.parse(before); if (!object(value)) fail('本机配置格式无效');
    change(value); const after = JSON.stringify(value, null, 2) + '\n'; if (Buffer.byteLength(after) > MAX_CONFIG) fail('配置文件超过大小限制');
    if (before !== null) await atomic(file + '.castiel.bak', before);
    const current = await textFile(file).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (current !== before) fail('配置已被其他程序修改，请刷新后重试');
    await atomic(file, after);
  }
  async manageCapability(args) {
    if (this.busy || this.runtime.capabilitiesBusy) throw this.error(new CapabilityError('另一项能力变更正在进行，请稍后重试'));
    const reading = args?.action === 'read';
    if (!reading && this.runtime.active().length) throw this.error(new CapabilityError('请先停止正在运行的 Agent，再修改本机能力'));
    this.busy = true; if (!reading) this.runtime.capabilitiesBusy = true;
    try {
      if (!reading && this.runtime.startQueue) await this.runtime.startQueue.catch(() => {});
      if (!reading && this.runtime.active().length) fail('请先停止正在运行的 Agent，再修改本机能力');
      const ctx = await this.context(args);
      if (!['skill', 'mcp'].includes(args.kind) || !['read', 'toggle', 'import', 'add', 'remove'].includes(args.action)) fail('不支持的能力操作');
      const catalog = await this.catalog(ctx);
      if (args.action === 'import' && args.kind === 'skill') {
        const selected = await this.dialog.showOpenDialog({ title: '导入本机 Skill 目录', properties: ['openDirectory'] });
        if (selected.canceled) return { ...catalog.value, canceled: true };
        await this.importSkill(ctx, selected.filePaths?.[0]);
      } else if (args.action === 'add' && args.kind === 'mcp') await this.addMcp(ctx, args.server, catalog);
      else {
        const item = catalog.entries.get(args.id); if (!item || item.kind !== args.kind) fail('能力来源已失效，请刷新后重试');
        if (args.action === 'read' && item.kind === 'skill') return { text: this.clean(await textFile(item.path, MAX_SKILL), MAX_SKILL) };
        if (args.action === 'toggle') {
          if (typeof args.enabled !== 'boolean') fail('无效的启用状态');
          if (item.kind === 'skill') await this.toggleSkill(ctx, item, args.enabled);
          else await this.toggleMcp(ctx, item, args.enabled);
        } else if (args.action === 'remove') {
          if (item.kind === 'skill') await this.removeSkill(ctx, item);
          else await this.removeMcp(ctx, item);
        } else fail('此能力不支持该操作');
      }
      const updated = (await this.catalog(ctx)).value, items = args.kind === 'skill' ? updated.skills : updated.mcp;
      if (args.action === 'toggle' && items.find(item => item.id === args.id)?.enabled !== args.enabled) fail('原工具未应用此启用状态，请刷新并检查更高优先级配置');
      if (args.action === 'remove' && items.some(item => item.id === args.id)) fail('原工具仍保留此来源，未确认移除成功');
      if (args.action === 'add' && !items.some(item => item.name === args.server.name && item.scope === 'user')) fail('原工具未返回新增配置，请刷新检查');
      return updated;
    } catch (e) { throw this.error(e); }
    finally { this.busy = false; if (!reading) this.runtime.capabilitiesBusy = false; }
  }
  async toggleSkill(ctx, item, enabled) {
    if (item.toggleable === false) fail('此 Skill 受其他来源的规则限制，请在原工具中管理');
    if (ctx.agent === 'Codex') { await this.backup(path.join(ctx.codexHome, 'config.toml')); await this.runtime.rpc.request('skills/config/write', { path: item.path, enabled }); }
    else await this.editJSON(path.join(ctx.claudeHome, 'settings.json'), config => {
      config.permissions ||= {}; if (!object(config.permissions) || (config.permissions.deny && !Array.isArray(config.permissions.deny))) fail('权限配置格式无效');
      const rules = ['Skill(' + item.name + ')', 'Skill(' + item.name + ' *)'];
      config.permissions.deny = (config.permissions.deny || []).filter(rule => !rules.includes(rule));
      if (!enabled) config.permissions.deny.push(...rules);
    });
  }
  async toggleMcp(ctx, item, enabled) {
    if (!item.editable) fail('此 MCP 来源只读，请在原工具中管理');
    if (ctx.agent === 'Codex') {
      await this.backup(item.file);
      await this.runtime.rpc.request('config/value/write', { keyPath: 'mcp_servers.' + item.name + '.enabled', value: enabled, mergeStrategy: 'replace', filePath: item.file, expectedVersion: item.version || null });
    } else await this.editJSON(ctx.claudeState, config => {
      config.projects ||= {}; config.projects[ctx.cwd] ||= {}; const project = config.projects[ctx.cwd];
      if (!object(project) || (project.disabledMcpServers && !Array.isArray(project.disabledMcpServers))) fail('MCP 开关配置格式无效');
      project.disabledMcpServers = (project.disabledMcpServers || []).filter(name => name !== item.name); if (!enabled) project.disabledMcpServers.push(item.name);
    });
  }
  server(server) {
    if (!object(server) || !NAME.test(server.name || '') || !['stdio', 'http'].includes(server.transport)) fail('MCP 名称或传输方式无效；名称仅支持字母、数字、下划线和连字符');
    if (Object.keys(server).some(key => !['name', 'transport', 'command', 'args', 'url', 'envKeys'].includes(key))) fail('MCP 仅支持环境变量名称引用，不接受凭据、请求头或环境变量值');
    const keys = server.envKeys || []; if (!Array.isArray(keys) || keys.length > 50 || keys.some(k => typeof k !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(k))) fail('请只填写环境变量名称，不填写值');
    if (server.transport === 'http') {
      let url; try { url = new URL(server.url); } catch { fail('请输入有效的 HTTP(S) MCP 地址'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || server.url.length > 2000) fail('MCP 地址不能包含凭据、查询参数或片段');
      if (keys.length) fail('HTTP 认证请在原工具中配置，本表单仅支持无凭据地址');
      return { name: server.name, type: 'http', url: url.href };
    }
    if (typeof server.command !== 'string' || server.command.length > 1000 || !server.command.trim() || /[\r\n\0]/.test(server.command) || !Array.isArray(server.args || []) || (server.args || []).length > 100) fail('本机 MCP 命令或参数无效');
    if ((server.args || []).some(arg => typeof arg !== 'string' || arg.length > 2000 || /[\r\n\0]/.test(arg) || /(?:token|api[_-]?key|secret|password|authorization)(?:=|:)|\bsk-[\w-]{8,}|Bearer\s/i.test(arg))) fail('参数不能包含明文凭据，请使用环境变量引用');
    return { name: server.name, type: 'stdio', command: server.command, args: server.args || [], envKeys: [...new Set(keys)] };
  }
  async addMcp(ctx, server, catalog) {
    const parsed = this.server(server); if (catalog.value.mcp.some(item => item.name === parsed.name)) fail('已存在同名 MCP，请使用不同名称');
    const { name, envKeys, ...config } = parsed;
    if (ctx.agent === 'Codex') {
      const file = path.join(ctx.codexHome, 'config.toml'); await this.backup(file);
      const layer = ctx.configResponse.layers?.find(l => l.name?.type === 'user' && !l.name.profile && path.resolve(l.name.file || '') === path.resolve(file));
      const value = config.type === 'http' ? { url: config.url } : { command: config.command, args: config.args, ...(envKeys.length ? { env_vars: envKeys } : {}) };
      await this.runtime.rpc.request('config/value/write', { keyPath: 'mcp_servers.' + name, value, mergeStrategy: 'replace', filePath: file, expectedVersion: layer?.version || null });
    } else {
      await this.backup(ctx.claudeState);
      if (config.type === 'stdio' && envKeys.length) config.env = Object.fromEntries(envKeys.map(key => [key, '${' + key + '}']));
      await this.command(ctx.tool.executable, ['mcp', 'add-json', name, JSON.stringify(config), '--scope', 'user'], this.runtime.env, 10000);
    }
  }
  async removeMcp(ctx, item) {
    if (!item.editable || item.scope !== 'user') fail('此 MCP 来源只读，请在原工具中管理');
    await this.backup(item.file);
    await this.command(ctx.tool.executable, ['mcp', 'remove', item.name, ...(ctx.agent === 'Claude' ? ['--scope', 'user'] : [])], this.runtime.env, 10000);
  }
  async importSkill(ctx, selected) {
    if (typeof selected !== 'string' || !path.isAbsolute(selected)) fail('未选择有效的 Skill 目录');
    const source = await fs.realpath(selected), name = path.basename(source); if (!NAME.test(name) || !(await fs.stat(source)).isDirectory()) fail('Skill 目录名称仅支持字母、数字、下划线和连字符');
    const root = ctx.agent === 'Codex' ? path.join(this.home, '.agents/skills') : path.join(ctx.claudeHome, 'skills'), target = path.join(root, name);
    await fs.mkdir(root, { recursive: true, mode: 0o700 }); if (await fs.realpath(root) !== path.resolve(root)) fail('Skill 安装目录包含符号链接，请在原工具中管理');
    if (await exists(target)) fail('已存在同名 Skill，不会覆盖');
    // Read and validate the entire bounded tree before creating an installation.
    const files = []; let total = 0, nodes = 0;
    const scan = async (folder, depth = 0) => {
      if (depth > 12) fail('Skill 目录层级过深');
      for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
        if (++nodes > 400) fail('Skill 目录包含过多文件或目录');
        if (entry.name.startsWith('.')) fail('Skill 导入不能包含隐藏文件；请先移除 .env、.git 等内容');
        const file = path.join(folder, entry.name), stat = await fs.lstat(file);
        if (stat.isSymbolicLink() || !within(source, await fs.realpath(file))) fail('Skill 导入不能包含符号链接或越界文件');
        if (stat.isDirectory()) await scan(file, depth + 1);
        else {
          if (!stat.isFile() || stat.size > MAX_CONFIG || files.length >= 200) fail('Skill 文件过多、过大或类型无效');
          const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0)); let bytes;
          try { bytes = await boundedBytes(handle, MAX_CONFIG); } finally { await handle.close(); }
          total += bytes.length; if (bytes.length > MAX_CONFIG || total > 10 * 1024 * 1024) fail('Skill 导入超过 10 MiB 大小限制');
          files.push({ relative: path.relative(source, file), bytes, executable: stat.mode & 0o111 });
        }
      }
    };
    await scan(source); const instructions = files.find(f => f.relative === 'SKILL.md'); if (!instructions || instructions.bytes.length > MAX_SKILL) fail('请选择包含有效 SKILL.md 的目录（上限 256 KiB）');
    const token = randomUUID(), imports = await this.manifest(); let created = false;
    try {
      await fs.mkdir(target, { mode: 0o700 }); created = true;
      for (const file of files) { const destination = path.join(target, file.relative); await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 }); await fs.writeFile(destination, file.bytes, { flag: 'wx', mode: 0o600 | file.executable }); }
      await fs.writeFile(path.join(target, '.castiel-import.json'), JSON.stringify({ token }), { flag: 'wx', mode: 0o600 });
      await this.editJSON(this.manifestFile, value => { value.imports = [...imports, { agent: ctx.agent, path: target, token }]; });
    } catch (e) { if (created) await fs.rm(target, { recursive: true, force: true }); throw e; }
  }
  async removeSkill(ctx, item) {
    const imports = await this.manifest(), root = ctx.agent === 'Codex' ? path.join(this.home, '.agents/skills') : path.join(ctx.claudeHome, 'skills'), target = path.dirname(item.path);
    if (!item.removable || path.dirname(target) !== root || !(await this.owned(ctx.agent, item.path, imports)) || await fs.realpath(root) !== path.resolve(root)) fail('只能移除工作台导入且来源仍有效的 Skill');
    const backupRoot = path.join(this.directory, 'capability-backups'); await fs.mkdir(backupRoot, { recursive: true, mode: 0o700 });
    if (await fs.realpath(backupRoot) !== path.resolve(backupRoot)) fail('能力备份目录包含符号链接，已阻止移除');
    const backup = path.join(backupRoot, ctx.agent + '-' + path.basename(target) + '-' + randomUUID());
    // Rename on the same filesystem, or copy exclusively before removing across devices.
    try { await fs.rename(target, backup); }
    catch (e) { if (e.code !== 'EXDEV') throw e; await fs.cp(target, backup, { recursive: true, errorOnExist: true, force: false, dereference: false }); await fs.rm(target, { recursive: true }); }
    try { await this.editJSON(this.manifestFile, value => { value.imports = imports.filter(entry => entry.agent !== ctx.agent || entry.path !== target); }); }
    catch (e) { await fs.rename(backup, target).catch(() => {}); throw e; }
  }
}
