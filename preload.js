const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printLabel: (labelContent) => ipcRenderer.send('print-label', labelContent)
});
