const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true, // Force Fullscreen for JAMB-like experience
    alwaysOnTop: true, // Stay above other apps
    kiosk: true, // LOCKDOWN MODE (Disables most OS shortcuts)
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false, // No title bar
    icon: path.join(__dirname, 'build', 'icon.ico')
  });

  // Load the web app
  // Points to localhost in dev, or build/index.html in production
  const url = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
  mainWindow.loadURL(url);

  // Security: Disable Refresh & Developer Tools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I') || input.key === 'F5') {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => (mainWindow = null));
}

// SECURITY LOCKDOWN: Disable dangerous keys at the OS level
app.whenReady().then(() => {
  createWindow();

  // Block Alt+Tab and Win Key (Windows specific)
  globalShortcut.register('Alt+Tab', () => {
    console.log('Alt+Tab is disabled');
    return false;
  });

  globalShortcut.register('CommandOrControl+R', () => {
    return false;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// For remote locking/closing via Admin
ipcMain.on('force-close', () => {
  app.quit();
});
