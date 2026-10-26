import path from 'node:path';
export function externalURL(value) {
  if (typeof value !== 'string' || value.length > 8000) throw new Error('无效的网页链接');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('只能打开普通 HTTP 或 HTTPS 网页链接');
  return url.href;
}
export function assetPath(url, root) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'castiel:' || parsed.hostname !== 'app') throw new Error('拒绝访问其他来源');
  const pathname = decodeURIComponent(parsed.pathname);
  if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('无效的资源路径');
  const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('资源超出应用目录');
  return target;
}
