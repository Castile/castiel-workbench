export class PersistenceEngine {
  constructor(api, loaded = {}) {
    this.api = api; this.data = loaded.data || {}; this.revision = loaded.revision || 0;
    this.recovered = Boolean(loaded.recovered); this.dirty = false; this.listeners = new Set();
    this.status = api ? (this.recovered ? 'recovery' : 'saved') : 'demo'; this.error = ''; this.generation = 0;
  }
  subscribe = callback => { this.listeners.add(callback); return () => this.listeners.delete(callback); };
  snapshot = () => this.status + ':' + this.error;
  emit() { for (const callback of this.listeners) callback(); }
  set(key, value) {
    if (JSON.stringify(this.data[key]) === JSON.stringify(value)) return;
    this.data = { ...this.data, [key]: value }; this.dirty = true; this.generation++;
    if (this.api && !this.recovered) {
      this.status = 'pending'; this.emit(); clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush().catch(() => {}), 220);
      this.maxTimer ??= setTimeout(() => this.flush().catch(() => {}), 1500);
    }
  }
  async flush() {
    clearTimeout(this.timer);
    clearTimeout(this.maxTimer); this.maxTimer = null;
    if (!this.api) return;
    if (!this.dirty) return;
    if (this.recovered) throw new Error('确认恢复备份后才可继续保存');
    if (this.inflight) { await this.inflight; if (this.dirty) return this.flush(); return; }
    this.inflight = (async () => {
      try {
        while (this.dirty) {
          const generation = this.generation, data = structuredClone(this.data);
          this.status = 'saving'; this.error = ''; this.emit();
          const result = await this.api.save(data, this.revision);
          this.revision = result.revision; this.dirty = this.generation !== generation;
        }
        this.status = 'saved'; this.emit();
      } catch (error) { this.status = 'error'; this.error = error.message; this.emit(); throw error; }
      finally { this.inflight = null; }
    })();
    return this.inflight;
  }
}
