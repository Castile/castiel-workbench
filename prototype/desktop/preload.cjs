const { contextBridge, ipcRenderer } = require('electron');
const invoke = async (name, ...args) => {
  const result = await ipcRenderer.invoke(name, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
contextBridge.exposeInMainWorld('castielDesktop', Object.freeze({
  load: () => invoke('storage:load'),
  save: (data, revision) => invoke('storage:save', data, revision),
  info: () => invoke('storage:info'),
  exportBackup: (data, revision) => invoke('storage:export', data, revision),
  importBackup: revision => invoke('storage:import', revision),
  restoreBackup: () => invoke('storage:restore'),
  chooseDirectory: () => invoke('workspace:choose-directory'),
  completeClose: (token, ok) => invoke('lifecycle:complete-close', token, ok),
  onFlushRequest: callback => {
    const listener = (_event, token) => callback(token);
    ipcRenderer.on('lifecycle:flush-request', listener);
    return () => ipcRenderer.removeListener('lifecycle:flush-request', listener);
  }
}));
