const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openProject: () => ipcRenderer.invoke('dialog:openProject'),
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  encryptString: (data) => ipcRenderer.invoke('safe-storage:encrypt', data),
  decryptString: (encrypted) => ipcRenderer.invoke('safe-storage:decrypt', encrypted),
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
});
