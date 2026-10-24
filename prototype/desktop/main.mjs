import { app, BrowserWindow, ipcMain, protocol, session, dialog, Menu } from 'electron';
import fs from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { LocalStore } from './store.mjs';
import { assetPath } from './assets.mjs';
import { encodeDocument } from '../src/state/document.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.CASTIEL_DATA_DIR || path.join(app.getPath('appData'), 'CastielWorkbench');
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
mkdirSync(path.join(dataDir, 'cache'), { recursive: true, mode: 0o700 });
app.setName('Castiel'); app.setPath('userData', dataDir);
app.setPath('sessionData', path.join(dataDir, 'cache'));
protocol.registerSchemesAsPrivileged([{ scheme: 'castiel', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const store = new LocalStore(dataDir);
let window, quitRequested = false, closeToken, closeTimer;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (!app.isReady()) return; if (!window) createWindow(); else { window.show(); window.focus(); } });
  app.on('activate', () => { if (app.isReady() && !window) createWindow(); });
  app.on('before-quit', event => { if (window && !window.isDestroyed()) { event.preventDefault(); quitRequested = true; requestClose(); } });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  // Resolving the ESM entry is necessary before Electron can emit ready.
  app.whenReady().then(async () => {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  protocol.handle('castiel', async request => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
      const file = assetPath(request.url, path.join(here, '../dist/client'));
      const bytes = await fs.readFile(file);
      return new Response(request.method === 'HEAD' ? null : bytes, { headers: { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' } });
    } catch { return new Response('Not found', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('castiel://app/') && !details.url.startsWith('devtools:') }));
  const handle = (name, action) => ipcMain.handle(name, async (event, ...args) => {
    try {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== 'castiel://app/') throw new Error('无效的应用请求');
      return { ok: true, value: await action(...args) };
    } catch (error) { return { ok: false, error: error.message }; }
  });
  handle('storage:load', () => store.load());
  handle('storage:save', (data, revision) => { if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('无效的保存版本'); return store.save(data, revision); });
  handle('storage:info', () => ({ directory: dataDir, file: store.file, version: app.getVersion(), packaged: app.isPackaged }));
  handle('storage:restore', () => store.restoreBackup());
  handle('workspace:choose-directory', async () => {
    const selected = await dialog.showOpenDialog(window, { title: '选择工作空间目录', properties: ['openDirectory'] });
    if (selected.canceled) return null;
    return fs.realpath(selected.filePaths[0]);
  });
  handle('storage:export', async (data, revision) => {
    if (data) { if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('无效的备份版本'); encodeDocument(data, revision + 1); }
    const selected = await dialog.showSaveDialog(window, { title: '导出工作台备份', defaultPath: 'Castiel-backup.json', filters: [{ name: '工作台备份', extensions: ['json'] }] });
    if (selected.canceled) return { canceled: true };
    await store.exportTo(selected.filePath, data ? { data, revision } : null); return { canceled: false };
  });
  handle('storage:import', async revision => {
    const selected = await dialog.showOpenDialog(window, { title: '恢复工作台备份', properties: ['openFile'], filters: [{ name: '工作台备份', extensions: ['json'] }] });
    if (selected.canceled) return { canceled: true };
    // Parse and validate before presenting a restore decision.
    await store.read(selected.filePaths[0]);
    const answer = await dialog.showMessageBox(window, { type: 'question', message: '使用此备份恢复工作台？', detail: '当前数据会先保留为上一版备份。恢复后重新加载界面。', buttons: ['取消', '恢复备份'], defaultId: 0, cancelId: 0 });
    if (answer.response !== 1) return { canceled: true };
    await store.importFrom(selected.filePaths[0], revision); return { canceled: false };
  });
  handle('lifecycle:complete-close', async (token, ok) => {
    if (token !== closeToken) throw new Error('关闭请求已失效');
    clearTimeout(closeTimer); closeToken = null;
    if (ok === true) { const keepBackground = (await store.read(store.file).catch(() => null))?.data?.preferences?.background !== false; const current = window; window = null; current.destroy(); if (quitRequested || !keepBackground || process.platform !== 'darwin') app.quit(); }
    else { quitRequested = false; dialog.showErrorBox('数据尚未保存', '窗口已保留，请检查保存提示并重试。'); }
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Castiel', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { type: 'separator' }, { role: 'quit' }] }, { role: 'editMenu' }, { role: 'viewMenu', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] }, { role: 'windowMenu' }]));
  createWindow();
  }).catch(error => { console.error('Castiel startup failed:', error); dialog.showErrorBox('Castiel 无法启动', error.message); app.exit(1); });
}
function requestClose() {
  if (!window || closeToken) return;
  closeToken = randomUUID(); window.webContents.send('lifecycle:flush-request', closeToken);
  closeTimer = setTimeout(() => { closeToken = null; quitRequested = false; dialog.showErrorBox('暂时无法完成保存', '应用尚未关闭。请确认数据已保存后重试。'); }, 15000);
}
function createWindow() {
  window = new BrowserWindow({ width: 1440, height: 960, minWidth: 800, minHeight: 680, title: 'Castiel', backgroundColor: '#ffffff', show: false, webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== 'castiel://app/') event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.on('close', event => { event.preventDefault(); requestClose(); });
  window.once('ready-to-show', () => window.show());
  window.loadURL('castiel://app/');
}
