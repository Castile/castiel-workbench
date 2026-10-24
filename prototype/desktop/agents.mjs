import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { CodexRPC } from './rpc.mjs';
import { desktopEnvironment, findCLI, command, readJSON, claudeSummary, modelName, redactError } from './discovery.mjs';

export const coreInstructions = '你在 Castiel 本地工作台中处理用户任务。遵守本机工具的权限与配置，不扩大授权范围。按任务加载必要资料；持续推进到实现、必要审查、验证和汇报闭环。阶段进展不等于完成。保留目标、状态、决策、已排除路径及原因、下一步。准确区分真实运行、未验证、失败与阻塞；不要虚构产物或测试结果。仅规划模式不能修改文件。';
const busy = run => ['starting', 'running', 'waiting', 'stopping'].includes(run.status);
const stamp = () => new Date().toISOString();
export class AgentRuntime {
  constructor({ store, emit = () => {}, home = os.homedir(), baseEnv = process.env }) {
    this.store = store; this.emit = emit; this.home = home; this.baseEnv = baseEnv;
    this.catalog = { checking: true, agents: {} }; this.runs = new Map(); this.pending = new Map(); this.cancelled = new Set(); this.startQueue = Promise.resolve();
  }
  active() { return [...this.runs.values()].filter(busy); }
  async detect() {
    if (this.detecting) return this.detecting;
    if (this.active().length) throw new Error('请在当前执行结束后重新检测');
    this.catalog = { ...this.catalog, checking: true }; this.emit({ type: 'catalog', catalog: this.catalog });
    this.detecting = (async () => {
      this.env = await desktopEnvironment(this.baseEnv, this.home); this.redactionEnv = { ...this.env };
      this.rpc?.close(); this.rpc = null;
      const entries = await Promise.all(['Codex', 'Claude'].map(async name => {
        const executable = await findCLI(name.toLowerCase(), this.env, this.home);
        if (!executable) return [name, { installed: false, ready: false, status: '未安装', models: [['system', '本机默认', '安装工具后自动读取']], message: '未找到本机 ' + name + ' 命令行工具' }];
        const info = { installed: true, executable, ready: false, models: [['system', '本机默认', '沿用工具配置']] };
        try {
          info.version = (await command(executable, ['--version'], this.env)).trim().slice(0, 120);
          if (name === 'Claude') {
            const configDir = this.env.CLAUDE_CONFIG_DIR || path.join(this.home, '.claude');
            const settings = await readJSON(path.join(configDir, 'settings.json'));
            this.redactionEnv = { ...this.redactionEnv, ...settings.env };
            const auth = await command(executable, ['auth', 'status', '--json'], this.env).then(JSON.parse).catch(() => ({}));
            Object.assign(info, claudeSummary(settings, this.env, auth), { configPaths: [path.join(configDir, 'settings.json')] });
          } else {
            const rpc = new CodexRPC(executable, this.env, { onMessage: msg => this.codexMessage(msg), onExit: () => {
              if (this.rpc !== rpc) return; this.rpc = null;
              for (const run of this.active().filter(r => r.agent === 'Codex')) this.finish(run, 'failed', 'Codex 连接已断开，可重新发送以继续');
              if (this.catalog.agents.Codex) { this.catalog = { ...this.catalog, agents: { ...this.catalog.agents, Codex: { ...this.catalog.agents.Codex, ready: false, status: '连接已断开', message: '请重新检测以连接本机 Codex' } } }; this.emit({ type: 'catalog', catalog: this.catalog }); }
            } });
            this.rpc = rpc; await rpc.initialize();
            const config = (await rpc.request('config/read', { includeLayers: false })).config || {};
            const auth = await rpc.request('account/read', { refreshToken: false });
            info.configuredModel = modelName(config.model) || null;
            info.provider = config.model_provider || '本机默认服务'; info.authenticated = Boolean(auth.account) || auth.requiresOpenaiAuth === false;
            info.authLabel = info.authenticated ? '沿用本机认证' : '请先在 Codex 登录';
            info.permission = { approval: config.approval_policy, sandbox: config.sandbox_mode };
            info.configPaths = [path.join(this.env.CODEX_HOME || path.join(this.home, '.codex'), 'config.toml')];
            const models = []; let cursor = null;
            try {
              do { const result = await rpc.request('model/list', { limit: 100, includeHidden: false, ...(cursor ? { cursor } : {}) }); models.push(...(result.data || [])); cursor = result.nextCursor; } while (cursor && models.length < 500);
            } catch { info.message = '模型目录暂未返回，仍可使用本机默认模型'; }
            info.models = [['system', info.configuredModel ? '本机默认 · ' + info.configuredModel : '本机默认', '沿用 Codex 的有效配置'], ...models.filter(m => modelName(m.model)).map(m => [m.model, String(m.displayName || m.model).slice(0, 150), '本机 Codex 模型目录；访问权限以实际调用为准'])];
            if (info.configuredModel && !info.models.some(m => m[0] === info.configuredModel)) info.models.push([info.configuredModel, info.configuredModel, '本机配置模型']);
          }
          info.ready = info.authenticated; info.status = info.ready ? '本机配置已加载' : '需要登录';
        } catch (error) { info.status = '检测失败'; info.message = redactError(error.message, this.redactionEnv); }
        return [name, info];
      }));
      this.catalog = { checking: false, checkedAt: stamp(), agents: Object.fromEntries(entries) };
      this.emit({ type: 'catalog', catalog: this.catalog }); return this.catalog;
    })().finally(() => { this.detecting = null; });
    return this.detecting;
  }
  snapshot() { return { catalog: this.catalog, runs: [...this.runs.values()].map(run => this.publicRun(run)) }; }
  publicRun(run) {
    const { child, killTimer, publishTimer, texts, currentMessage, ...value } = run; return value;
  }
  publish(run) {
    if (run.texts) run.text = [...run.texts.values()].filter(Boolean).join('\n\n').slice(0, 2 * 1024 * 1024);
    this.emit({ type: 'run', run: this.publicRun(run) });
  }
  note(run, text) { run.events = [...run.events.slice(-29), redactError(text, this.redactionEnv).slice(0, 500)]; this.publish(run); }
  text(run, id, text, append = false) {
    run.texts.set(id, ((append ? run.texts.get(id) || '' : '') + text).slice(0, 2 * 1024 * 1024));
    if (!run.publishTimer) run.publishTimer = setTimeout(() => { run.publishTimer = null; this.publish(run); }, 60);
  }
  finish(run, status, error = '') {
    if (!busy(run)) return;
    clearTimeout(run.publishTimer); run.publishTimer = null;
    run.status = status; run.error = redactError(error, this.redactionEnv); if (!error) run.error = '';
    if (run.agent === 'Claude' && /\b402\b|Insufficient Balance/i.test(run.error)) run.error = '本机 Claude 配置的服务余额不足（402），请检查当前服务账户后重试。\n' + run.error;
    run.completedAt = stamp();
    for (const [token, pending] of this.pending) if (pending.run === run) this.pending.delete(token);
    delete run.request; this.publish(run);
  }
  start(args) { const next = this.startQueue.then(() => this.prepareStart(args)); this.startQueue = next.catch(() => {}); return next; }
  async prepareStart({ sessionId, prompt, requestId }) {
    if (typeof sessionId !== 'string' || typeof prompt !== 'string' || !prompt.trim() || prompt.length > 6000) throw new Error('无效的会话输入');
    if (requestId !== undefined && !/^[a-zA-Z0-9-]{1,100}$/.test(requestId)) throw new Error('无效的执行标识');
    if (this.detecting) await this.detecting;
    if (this.active().some(run => run.sessionId === sessionId)) throw new Error('此会话正在执行，请先停止或等待完成');
    const doc = await this.store.read(this.store.file), data = doc.data;
    const limit = Math.max(1, Math.min(6, Number(data.preferences?.concurrency) || 3));
    if (this.active().length >= limit) throw new Error('已达到并行上限 ' + limit + '，请等待其他会话完成');
    const session = data.records?.sessions.find(s => s.id === sessionId || s.taskId === sessionId);
    if (!session || session.sessionArchived) throw new Error('会话不存在或已归档');
    const agent = session.agent, tool = this.catalog.agents[agent];
    if (!tool?.ready) throw new Error(tool?.message || tool?.authLabel || '此工具尚未连接本机配置');
    if (!data.agentConfig?.[agent]?.enabled) throw new Error('此 Agent 已停用');
    if (session.model && !tool.models.some(m => m[0] === session.model)) throw new Error('此模型不在本机配置中，请重新选择模型');
    const scope = session.workspaceSnapshot || data.spaces?.find(s => s.id === session.workspaceId);
    if (!scope) throw new Error('请先选择工作空间');
    let cwd = scope.path;
    if (!cwd) {
      const folder = /^[a-zA-Z0-9_-]{1,80}$/.test(session.workspaceId) ? session.workspaceId : createHash('sha256').update(String(session.workspaceId)).digest('hex').slice(0, 24);
      cwd = path.join(this.store.directory, 'workspaces', folder); await fs.mkdir(cwd, { recursive: true, mode: 0o700 });
    }
    if (!path.isAbsolute(cwd) || !(await fs.stat(cwd)).isDirectory()) throw new Error('工作空间目录不存在');
    cwd = await fs.realpath(cwd);
    if (requestId && this.cancelled.has(requestId)) throw new Error('本轮已停止');
    const previous = session.runtime;
    const externalId = previous?.agent === agent && previous.cwd === cwd && previous.status !== 'handedOff' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(previous.externalId || '') ? previous.externalId : null;
    const requestedModel = session.model || 'system';
    const executionModel = externalId && requestedModel === 'system' ? (previous?.requestedModel === 'system' ? modelName(previous.model) : tool.configuredModel) || 'system' : requestedModel;
    const rule = previous?.ruleSnapshot || data.ruleHistory?.find(r => r.version === session.ruleVersion && r.body)?.body || '';
    const planning = session.agentSettingsSnapshot?.executionMode === '仅规划' || data.preferences?.local === false;
    const instructions = [coreInstructions, rule.slice(0, 12000), session.agentSettingsSnapshot?.instructions || '', planning ? '本轮仅规划，不修改文件。' : ''].filter(Boolean).join('\n\n');
    const history = session.messages.filter(m => ['我', 'Codex', 'Claude', 'Gemini'].includes(m.who)).slice(-20).slice(0, -1).map(m => `${m.who}: ${m.text}`).join('\n\n').slice(-40000);
    const recoveryText = history ? `工作台中的既有会话记录：\n${history}\n\n用户本轮请求：\n${prompt}` : prompt;
    const text = externalId ? prompt : recoveryText;
    const run = { id: requestId || randomUUID(), sessionId, agent, requestedModel, model: executionModel === 'system' ? tool.configuredModel : executionModel, cwd, externalId, ruleSnapshot: rule, status: 'starting', text: '', texts: new Map(), events: [], startedAt: stamp(), error: '' };
    this.runs.set(sessionId, run);
    for (const [key, value] of this.runs) if (this.runs.size > 64 && !busy(value)) this.runs.delete(key);
    this.publish(run);
    (agent === 'Codex' ? this.codexRun(run, { text, recoveryText, instructions, planning, model: executionModel }) : this.claudeRun(run, { text, instructions, planning, model: executionModel, executable: tool.executable })).catch(error => this.finish(run, 'failed', error.message));
    return this.publicRun(run);
  }
  async codexRun(run, { text, recoveryText, instructions, planning, model }) {
    if (!this.rpc) throw new Error('Codex 连接已断开，请重新检测');
    const options = { cwd: run.cwd, ...(model && model !== 'system' ? { model } : {}), ...(planning ? { sandbox: 'read-only' } : {}) };
    let result;
    try { result = await this.rpc.request(run.externalId ? 'thread/resume' : 'thread/start', { ...options, ...(run.externalId ? { threadId: run.externalId } : { developerInstructions: instructions }) }, 30000); }
    catch (error) {
      if (!run.externalId || !/no rollout found|thread.*not found/i.test(error.message)) throw error;
      if (run.status === 'stopping') return this.finish(run, 'interrupted');
      run.externalId = null; this.note(run, '本机旧会话文件不存在，已使用工作台记录重新建立上下文');
      result = await this.rpc.request('thread/start', { ...options, developerInstructions: instructions }, 30000); text = recoveryText;
    }
    run.externalId = result.thread.id; run.model = result.model || run.model;
    if (run.status === 'stopping') return this.finish(run, 'interrupted');
    run.status = 'running'; this.publish(run);
    const started = await this.rpc.request('turn/start', { threadId: run.externalId, input: [{ type: 'text', text }], ...(model && model !== 'system' ? { model } : {}) }, 30000);
    run.turnId = started.turn.id;
    if (run.status === 'stopping') await this.rpc.request('turn/interrupt', { threadId: run.externalId, turnId: run.turnId });
    this.publish(run);
  }
  codexMessage(message) {
    const p = message.params || {}, threadId = p.threadId || p.thread?.id;
    const run = [...this.runs.values()].find(r => r.agent === 'Codex' && r.externalId === threadId && busy(r));
    if (message.id !== undefined && message.method) {
      if (!run) return this.rpc?.send({ id: message.id, error: { code: -32601, message: 'No active Castiel turn' } });
      const kind = { 'item/commandExecution/requestApproval': 'command', 'item/fileChange/requestApproval': 'files', 'item/tool/requestUserInput': 'questions' }[message.method];
      if (!kind || p.grantRoot) { this.note(run, '工具请求暂不支持，未扩大权限：' + message.method); return this.rpc?.send({ id: message.id, error: { code: -32601, message: 'Unsupported request; permission was not granted' } }); }
      const token = randomUUID(); this.pending.set(token, { run, id: message.id, kind, questions: p.questions });
      run.request = { token, kind, command: redactError(p.command || '', this.redactionEnv), cwd: p.cwd || run.cwd, reason: redactError(p.reason || '', this.redactionEnv), questions: p.questions || [] };
      run.status = 'waiting'; this.publish(run); return;
    }
    if (!run) return;
    if (message.method === 'item/agentMessage/delta') this.text(run, p.itemId || 'response', p.delta || '', true);
    if (message.method === 'item/started') {
      if (p.item?.type === 'commandExecution') this.note(run, '运行命令：' + p.item.command);
      if (p.item?.type === 'fileChange') this.note(run, '正在处理文件变更');
    }
    if (message.method === 'item/completed' && p.item?.type === 'agentMessage') this.text(run, p.item.id, p.item.text || '');
    if (message.method === 'error') this.note(run, p.error?.message || '工具报告错误');
    if (message.method === 'turn/completed') this.finish(run, p.turn.status === 'completed' ? 'completed' : p.turn.status === 'interrupted' ? 'interrupted' : 'failed', p.turn.error?.message || '');
  }
  answer({ token, decision, answers = {} }) {
    const pending = this.pending.get(token); if (!pending) throw new Error('这条请求已结束');
    let result;
    if (pending.kind === 'questions') {
      const values = {};
      for (const q of pending.questions) { const value = answers[q.id]; if (typeof value !== 'string' || value.length > 4000) throw new Error('请回答所有问题'); values[q.id] = { answers: [value] }; }
      result = { answers: values };
    } else { if (!['accept', 'decline'].includes(decision)) throw new Error('无效的授权选择'); result = { decision }; }
    this.rpc.send({ id: pending.id, result }); this.pending.delete(token); delete pending.run.request; pending.run.status = 'running'; this.publish(pending.run);
  }
  async claudeRun(run, { text, instructions, planning, model, executable }) {
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--append-system-prompt', instructions];
    if (run.externalId) args.push('--resume', run.externalId);
    if (model && model !== 'system') args.push('--model', model);
    if (planning) args.push('--permission-mode', 'plan');
    const child = spawn(executable, args, { cwd: run.cwd, env: this.env, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32', windowsHide: true }); run.child = child;
    run.status = 'running'; this.publish(run); let result;
    let stderr = ''; child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-6000); });
    child.stdin.on('error', () => {}); child.stdin.end(text);
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      let event; try { event = JSON.parse(line); } catch { return; }
      if (event.parent_tool_use_id) return;
      if (event.session_id) run.externalId = event.session_id;
      if (event.type === 'system' && event.subtype === 'init') { run.model = event.model || run.model; this.publish(run); }
      if (event.type === 'stream_event') {
        const value = event.event;
        if (value?.type === 'message_start') run.currentMessage = value.message?.id || 'response';
        if (value?.delta?.type === 'text_delta') this.text(run, run.currentMessage || 'response', value.delta.text, true);
      }
      if (event.type === 'assistant') {
        const parts = event.message?.content || [], value = parts.filter(b => b.type === 'text').map(b => b.text).join('\n');
        if (value) this.text(run, event.message.id || run.currentMessage || 'response', value);
        for (const tool of parts.filter(b => b.type === 'tool_use')) this.note(run, '调用工具：' + tool.name);
      }
      if (event.type === 'system' && event.subtype === 'api_retry') this.note(run, '服务重试：' + (event.error || event.error_status || '连接暂时不可用'));
        if (event.type === 'result') { result = event; if (![...run.texts.values()].some(Boolean) && event.result) this.text(run, 'response', event.result); }
    });
    await new Promise(resolve => {
      child.on('error', error => { this.finish(run, 'failed', error.message); resolve(); });
      child.on('close', code => {
        clearTimeout(run.killTimer); lines.close();
        if (run.status === 'stopping') this.finish(run, 'interrupted');
        else if (result?.permission_denials?.length) this.finish(run, 'blocked', '本机 Claude 权限规则未允许部分工具操作；没有跳过权限。请检查工具输出或在 Claude Code 中配置授权后重试。');
        else if (code === 0 && result && !result.is_error) this.finish(run, 'completed');
        else this.finish(run, 'failed', result?.errors?.join('\n') || result?.result || stderr || 'Claude 未返回有效结果，请检查本机认证与服务配置');
        resolve();
      });
    });
  }
  async stop(sessionId, requestId) {
    if (requestId) { this.cancelled.add(requestId); if (this.cancelled.size > 256) this.cancelled.delete(this.cancelled.values().next().value); }
    const run = this.runs.get(sessionId); if (!run || !busy(run) || requestId && run.id !== requestId) return null;
    run.status = 'stopping';
    if (run.agent === 'Codex') {
      for (const [token, pending] of this.pending) if (pending.run === run) { this.rpc?.send({ id: pending.id, error: { code: -32800, message: 'Cancelled by user' } }); this.pending.delete(token); }
      delete run.request;
      if (run.externalId && run.turnId) {
        try { await this.rpc.request('turn/interrupt', { threadId: run.externalId, turnId: run.turnId }); }
        catch (error) { run.status = 'running'; this.note(run, '停止请求尚未确认，请重试'); throw error; }
      }
    } else if (run.child) {
      const kill = signal => { try { process.platform === 'win32' ? run.child.kill(signal) : process.kill(-run.child.pid, signal); } catch {} };
      kill('SIGINT'); run.killTimer = setTimeout(() => { kill('SIGKILL'); this.finish(run, 'interrupted'); }, 2500);
    }
    this.publish(run);
    return this.publicRun(run);
  }
  shutdown() { this.rpc?.close(); for (const run of this.active()) { if (run.child) { try { process.kill(-run.child.pid, 'SIGTERM'); } catch {} } } }
}
