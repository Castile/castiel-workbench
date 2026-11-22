export const FORMAT = 'castiel-workbench';
export const SCHEMA_VERSION = 1;
export const MAX_BYTES = 10 * 1024 * 1024;
const dangerous = new Set(['__proto__', 'prototype', 'constructor']);
export function validateData(data) {
  let count = 0;
  function visit(value, depth = 0) {
    if (++count > 200000 || depth > 24) throw new Error('数据结构过大或层级过深');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'string' && value.length <= 2000000) return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) { if (value.length > 50000) throw new Error('记录数量超出限制'); value.forEach(v => visit(v, depth + 1)); return; }
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      for (const [key, child] of Object.entries(value)) { if (dangerous.has(key)) throw new Error('无效的数据字段'); if (child !== undefined) visit(child, depth + 1); }
      return;
    }
    throw new Error('数据包含不支持的值');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('无效的工作台数据');
  visit(data);
  const collection = (items, name) => {
    if (!Array.isArray(items)) throw new Error(name + '必须为列表');
    const ids = new Set();
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error(name + '标识无效或重复');
      ids.add(item.id);
    }
  };
  if (data.records) {
    collection(data.records.tasks, '任务'); collection(data.records.sessions, '会话');
    const taskIds = new Set(data.records.tasks.map(t => t.id));
    const linked = new Set();
    for (const s of data.records.sessions) {
      if (taskIds.has(s.id)) throw new Error('会话与任务不能使用相同标识');
      if (typeof s.title !== 'string' || !Array.isArray(s.messages)) throw new Error('会话内容无效');
      if (s.taskId !== null && (!taskIds.has(s.taskId) || linked.has(s.taskId))) throw new Error('会话关联的任务不存在或重复');
      if (s.taskId !== null) linked.add(s.taskId);
    }
  }
  for (const key of ['members', 'projects', 'spaces','plItems','plEvents','plSources','plCoaching','plGoals','plReviews']) if (data[key] !== undefined) collection(data[key], key);
  if (data.members && !data.members.some(member => member.id === 'me')) throw new Error('成员列表必须保留本人');
  if (data.spaces?.some(s => 'projectId' in s || typeof s.name !== 'string' || typeof s.path !== 'string')) throw new Error('工作空间只能独立绑定本地目录');
  if (data.theme && !['light', 'dark', 'system'].includes(data.theme)) throw new Error('无效的外观设置');
  return data;
}
export function encodeDocument(data, revision = 1) {
  validateData(data);
  const value = JSON.stringify({ format: FORMAT, schemaVersion: SCHEMA_VERSION, revision, savedAt: new Date().toISOString(), data }, null, 2);
  if (new TextEncoder().encode(value).length > MAX_BYTES) throw new Error('工作台数据超过 10MB 限制，请先导出整理');
  return value;
}
export function decodeDocument(text) {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('备份文件超过 10MB 限制');
  const doc = JSON.parse(text);
  if (doc.format !== FORMAT) throw new Error('这不是工作台备份文件');
  if (doc.schemaVersion !== SCHEMA_VERSION) { const error = new Error('无法读取此数据版本，请使用匹配版本的工作台'); error.code = 'UNSUPPORTED_VERSION'; throw error; }
  if (!Number.isSafeInteger(doc.revision) || doc.revision < 1) throw new Error('数据版本号无效');
  validateData(doc.data);
  return doc;
}
