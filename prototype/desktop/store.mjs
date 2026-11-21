import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { decodeDocument, encodeDocument, MAX_BYTES } from '../src/state/document.js';

export class LocalStore {
  constructor(directory) {
    if (!path.isAbsolute(directory)) throw new Error('数据目录必须为绝对路径');
    this.directory = directory; this.file = path.join(directory, 'workbench.json');
    this.backup = this.file + '.bak'; this.queue = Promise.resolve(); this.recovery = false;
  }
  async read(file) {
    if ((await fs.stat(file)).size > MAX_BYTES) throw new Error('数据文件超过大小限制');
    return decodeDocument(await fs.readFile(file, 'utf8'));
  }
  async load() {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    try { const doc = await this.read(this.file); this.recovery = false; return { data: doc.data, revision: doc.revision, recovered: false }; }
    catch (error) {
      if (error.code === 'UNSUPPORTED_VERSION') throw error;
      try { const doc = await this.read(this.backup); this.recovery = true; return { data: doc.data, revision: doc.revision, recovered: true }; }
      catch { if (error.code === 'ENOENT') { try { await fs.access(this.backup); } catch (e) { if (e.code === 'ENOENT') return { data: {}, revision: 0, recovered: false }; } } }
      throw new Error('本地数据无法读取，已阻止覆盖。请保留原文件并检查备份。');
    }
  }
  run(action) { const next = this.queue.then(action); this.queue = next.catch(() => {}); return next; }
  async atomic(file, text) {
    const temporary = file + '.' + randomUUID() + '.tmp';
    let handle;
    try {
      handle = await fs.open(temporary, 'wx', 0o600); await handle.writeFile(text, 'utf8'); await handle.sync(); await handle.close(); handle = null;
      await fs.rename(temporary, file);
      // Windows supports flushing the temporary file, but not opening its parent for fsync.
    if (process.platform !== 'win32') {
      const directory = await fs.open(path.dirname(file), 'r'); try { await directory.sync(); } finally { await directory.close(); }
    }
    } finally { await handle?.close(); await fs.unlink(temporary).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
  }
  save(data, expectedRevision) {
    // Validate before queuing; never let later mutations change an accepted write.
    const captured = JSON.parse(encodeDocument(data));
    return this.run(async () => {
      if (this.recovery) throw new Error('请先确认恢复备份，再继续保存');
      let current;
      try { current = await this.read(this.file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      if ((current?.revision || 0) !== expectedRevision) throw new Error('数据已被另一轮修改，请重新加载后再保存');
      const revision = expectedRevision + 1;
      const text = encodeDocument(captured.data, revision);
      if (current) await this.atomic(this.backup, JSON.stringify(current, null, 2));
      await this.atomic(this.file, text);
      return { revision, savedAt: JSON.parse(text).savedAt };
    });
  }
  restoreBackup() {
    return this.run(async () => {
      if (!this.recovery) throw new Error('当前数据可正常读取，无需恢复损坏文件');
      const backup = await this.read(this.backup);
      try { await fs.copyFile(this.file, this.file + '.corrupt-' + Date.now(), fs.constants.COPYFILE_EXCL); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      await this.atomic(this.file, encodeDocument(backup.data, backup.revision + 1));
      this.recovery = false;
      return { revision: backup.revision + 1 };
    });
  }
  async exportTo(file, draft) {
    if ([this.file, this.backup].includes(path.resolve(file))) throw new Error('请选择工作数据和自动备份以外的位置');
    await this.queue;
    const text = draft ? encodeDocument(draft.data, draft.revision + 1) : JSON.stringify(await this.read(this.file), null, 2);
    await this.atomic(file, text);
  }
  async importFrom(file, revision) { const doc = await this.read(file); return this.save(doc.data, revision); }
}
