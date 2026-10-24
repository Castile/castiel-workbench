import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// JSONL over private pipes. No TCP listener or shell interpolation.
export class CodexRPC {
  constructor(executable, env, { onMessage = () => {}, onExit = () => {}, spawnProcess = spawn } = {}) {
    this.pending = new Map(); this.nextId = 0; this.onMessage = onMessage;
    this.child = spawnProcess(executable, ['app-server', '--listen', 'stdio://'], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.child.stdin.on('error', () => {});
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', line => {
      if (line.length > 8 * 1024 * 1024) return this.close();
      let value; try { value = JSON.parse(line); } catch { return; }
      const pending = !value.method && this.pending.get(value.id);
      if (pending) { clearTimeout(pending.timer); this.pending.delete(value.id); value.error ? pending.reject(new Error(value.error.message)) : pending.resolve(value.result); }
      else this.onMessage(value);
    });
    // CLI diagnostics can contain provider details. Do not send raw stderr to the renderer.
    this.child.stderr.resume();
    const exited = error => {
      if (this.exited) return; this.exited = true;
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error(error?.message || 'Codex 连接已结束')); }
      this.pending.clear(); this.lines.close(); onExit(error);
    };
    this.child.on('error', exited); this.child.on('exit', () => exited());
  }
  send(value) { if (this.exited) throw new Error('Codex 连接已结束'); this.child.stdin.write(JSON.stringify(value) + '\n'); }
  request(method, params = {}, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Codex 请求超时：' + method)); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  async initialize() {
    await this.request('initialize', { clientInfo: { name: 'castiel_workbench', title: 'Castiel', version: '0.2.0' } });
    this.send({ method: 'initialized', params: {} }); return this;
  }
  close() { this.child.kill('SIGTERM'); }
}
