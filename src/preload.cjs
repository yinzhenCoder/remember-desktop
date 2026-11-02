const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("remember", {
  state: () => ipcRenderer.invoke("state"),
  save: (config) => ipcRenderer.invoke("save-config", config),
  session: (action) => ipcRenderer.invoke("session", action),
  preview: (id, options) => ipcRenderer.invoke("preview", id, options),
  respond: (id, action) => ipcRenderer.invoke("respond", id, action),
  closePin: () => ipcRenderer.invoke("close-pin"),
  export: (format, from, to) => ipcRenderer.invoke("export", format, from, to),
  dataFolder: () => ipcRenderer.invoke("data-folder"),
  onState: (fn) => {
    const h = (_, value) => fn(value);
    ipcRenderer.on("state-changed", h);
    return () => ipcRenderer.removeListener("state-changed", h);
  },
  onReminder: (fn) => {
    const h = (_, value) => fn(value);
    ipcRenderer.on("reminder", h);
    return () => ipcRenderer.removeListener("reminder", h);
  },
});
