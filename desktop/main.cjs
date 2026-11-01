// Duel Racer para computador: abre o jogo (a mesma versão web, em app/) numa janela própria,
// em tela cheia, sem menus do navegador. F11 alterna tela cheia/janela.
const { app, BrowserWindow, protocol, net, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// os arquivos do jogo são servidos por app://jogo/ (origem fixa: salvamentos e recordes ficam
// guardados entre as aberturas, e a música carrega como no site)
// placa de vídeo sempre: sem estas opções, placas de vídeo/drivers na lista de bloqueio do
// Chromium desenhavam o jogo pelo processador (queda de quadros, principalmente à noite)
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
// notebooks com duas placas: prefere a dedicada
app.commandLine.appendSwitch('force_high_performance_gpu');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 800, minHeight: 450,
    fullscreen: true, backgroundColor: '#000000', autoHideMenuBar: true, title: 'Duel Racer',
    icon: path.join(__dirname, 'app', 'icons', 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.loadURL('app://jogo/index.html');
  // grava no disco os salvamentos (progresso, recordes, carreira) ao fechar, sem esperar o
  // gravador automático do Chromium
  win.on('close', () => win.webContents.session.flushStorageData());
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const root = path.join(__dirname, 'app');
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(file).toString(), { headers: req.headers });
  });
  createWindow();
});
app.on('before-quit', () => {
  const { session } = require('electron');
  session.defaultSession.flushStorageData();
});
app.on('window-all-closed', () => app.quit());
