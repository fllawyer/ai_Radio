const { app, BrowserWindow, Menu, shell } = require('electron');
const { join } = require('node:path');
const { createServer } = require('node:net');

let mainWindow = null;
let serverPort = null;

function getAvailablePort(start = 3730, maxAttempts = 80) {
  return new Promise((resolve, reject) => {
    let port = start;

    const tryPort = () => {
      const tester = createServer();
      tester.once('error', () => {
        port += 1;
        if (port >= start + maxAttempts) {
          reject(new Error('找不到可用本地端口'));
          return;
        }
        tryPort();
      });
      tester.once('listening', () => {
        tester.close(() => resolve(port));
      });
      tester.listen(port, '127.0.0.1');
    };

    tryPort();
  });
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 15_000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/healthz`);
      if (res.ok) return;
    } catch (e) {
      lastError = e;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Claudio 服务启动超时：${lastError?.message || '未知错误'}`);
}

async function startEmbeddedServer() {
  serverPort = await getAvailablePort();

  process.env.PORT = String(serverPort);
  process.env.HOST = '127.0.0.1';
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';
  process.env.STATE_FILE = join(app.getPath('userData'), 'state.json');
  process.env.CACHE_DIR = join(app.getPath('userData'), 'cache');

  await import('../server.js');

  const baseUrl = `http://127.0.0.1:${serverPort}`;
  await waitForServer(baseUrl);
  return baseUrl;
}

function createMenu() {
  const template = [
    {
      label: 'Claudio',
      submenu: [
        { role: 'about', label: '关于 Claudio' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 Claudio' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: '退出 Claudio' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新载入' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭窗口' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const baseUrl = await startEmbeddedServer();

  mainWindow = new BrowserWindow({
    width: 420,
    height: 820,
    minWidth: 380,
    minHeight: 640,
    title: 'Claudio',
    backgroundColor: '#1a1a2e',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(baseUrl);
}

app.whenReady().then(async () => {
  createMenu();
  try {
    await createWindow();
  } catch (e) {
    console.error(e);
    app.quit();
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
