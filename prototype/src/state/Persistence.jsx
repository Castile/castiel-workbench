import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { PersistenceEngine } from './engine.js';
const Context = createContext(null);
export const isDesktop = () => Boolean(window.castielDesktop);
export async function loadPersistence() {
  const api = window.castielDesktop;
  return new PersistenceEngine(api, api ? await api.load() : {});
}
export function PersistenceProvider({ engine, children }) {
  return <Context.Provider value={engine}>{children}</Context.Provider>;
}
export function useDurableState(key, initial) {
  const engine = useContext(Context);
  const [value, setValue] = useState(() => engine.data[key] ?? (typeof initial === 'function' ? initial() : initial));
  useEffect(() => { engine.set(key, value); }, [engine, key, value]);
  return [value, setValue];
}
export function usePersistence() {
  const engine = useContext(Context);
  useSyncExternalStore(engine.subscribe, engine.snapshot);
  return engine;
}
export function StorageStatus() {
  const engine = usePersistence();
  if (!engine.api) return null;
  const label = { saved: '已保存到本机', pending: '待保存', saving: '正在保存…', error: '尚未保存', recovery: '需要恢复备份' }[engine.status];
  const recover = async () => { try { await engine.api.restoreBackup(); window.location.reload(); } catch (e) { engine.error = e.message; engine.emit(); } };
  return <div className={'storage-status ' + engine.status} role="status"><span>{label}</span>{engine.status === 'error' && <><small>{engine.error}</small><button onClick={() => engine.flush().catch(() => {})}>重试保存</button></>}{engine.recovered && <><small>{engine.error || '主数据文件无法读取，当前显示最近备份，尚未覆盖原文件。'}</small><button onClick={recover}>确认恢复备份</button></>}</div>;
}
export function StorageLoadError({ error, onRetry }) { return <main className="storage-gate"><h1>本地数据暂时无法读取</h1><p>{error}</p><p>原文件已保留，请检查数据目录与文件权限后重试。</p><button onClick={onRetry}>重新加载</button></main>; }
