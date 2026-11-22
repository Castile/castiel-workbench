import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function sourceEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('请输入有效的 HTTPS 接口地址'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash)
    throw new Error('数据源需要 HTTPS 地址，请用凭据栏设置认证');
  if ([...url.searchParams.keys()].some(key => /(?:token|password|secret|api[-_]?key|signature|credential)/i.test(key))) throw new Error('请在凭据栏填写认证信息');
  return url.href;
}

export async function boundedText(response, limit) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('服务没有返回正文');
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new Error('服务响应超过大小限制，请缩小查询范围');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}

export class CompanySources {
  constructor(store, safeStorage, request = fetch) {
    this.store = store;
    this.secrets = safeStorage;
    this.request = request;
  }
  async resolve(sourceId) {
    if (typeof sourceId !== 'string' || !sourceId || sourceId.length > 160) throw new Error('数据源标识无效');
    const doc = await this.store.read(this.store.file);
    const source = doc.data.plSources?.find(item => item.id === sourceId);
    if (!source) throw new Error('请先保存数据源');
    const url = sourceEndpoint(source.url);
    const key = createHash('sha256').update(sourceId).digest('hex');
    return {url, file: path.join(this.store.directory, 'source-credentials', key)};
  }
  async setToken({sourceId, token}) {
    if (typeof token !== 'string' || token.length > 8192 || /[\r\n]/.test(token)) throw new Error('凭据格式无效');
    const {url, file} = await this.resolve(sourceId);
    if (!token) { await fs.rm(file, {force:true}); return; }
    if (!this.secrets.isEncryptionAvailable()) throw new Error('系统凭据加密暂不可用');
    const encrypted = this.secrets.encryptString(JSON.stringify({url, token})).toString('base64');
    await fs.mkdir(path.dirname(file), {recursive:true, mode:0o700});
    await this.store.atomic(file, encrypted);
  }
  async read({sourceId}) {
    const {url, file} = await this.resolve(sourceId);
    const headers = {Accept:'application/json'};
    let encrypted;
    try { encrypted = await fs.readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (encrypted) {
      let stored;
      try { stored = JSON.parse(this.secrets.decryptString(Buffer.from(encrypted, 'base64'))); }
      catch { throw new Error('系统无法解密凭据，请在系统接入中重新设置'); }
      if (stored.url !== url) throw new Error('接口地址已改变，请重新设置或清除该数据源凭据');
      headers.Authorization = 'Bearer ' + stored.token;
    }
    const response = await this.request(url, {method:'GET', headers, redirect:'error', signal:AbortSignal.timeout(20000)});
    if (!response.ok) { await response.body?.cancel(); throw new Error('读取数据源失败（HTTP '+response.status+'）'); }
    const body = await boundedText(response, 1024 * 1024);
    try { return JSON.parse(body); } catch { throw new Error('数据源返回的内容并非有效 JSON'); }
  }
}
