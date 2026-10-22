// Sandboxed preload: CommonJS, only the `electron` module is available.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  info: () => ipcRenderer.invoke('desktop:info'),
  setPrefs: patch => ipcRenderer.invoke('desktop:prefs', patch),
  setTheme: theme => ipcRenderer.send('desktop:theme', theme),
  setLang: lang => ipcRenderer.send('desktop:lang', lang),
  setAttention: (count, tip) => ipcRenderer.send('desktop:attention', { count, tip }),
  show: () => ipcRenderer.send('desktop:show'),
  onCommand: (fn) => {
    const listener = (_e, cmd, arg) => fn(cmd, arg)
    ipcRenderer.on('command', listener)
    return () => ipcRenderer.removeListener('command', listener)
  },
})
