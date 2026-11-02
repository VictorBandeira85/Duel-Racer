// ponte mínima entre o jogo e a janela do programa: minimizar e sair
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  minimize: () => ipcRenderer.send('janela', 'minimizar'),
  quit: () => ipcRenderer.send('janela', 'sair'),
});
