const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 500,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', async (event) => {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Cancel', 'OK'],
      title: 'Confirm',
      message: 'Are you sure you want to close the application?',
    });
    if (response.response === 0) {
      event.preventDefault();
    }
  });
}

ipcMain.on('get-printer-info', async (event) => {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    event.sender.send('printer-info', printers);
  } catch (error) {
    console.error('Failed to retrieve printers:', error);
    event.sender.send('printer-info-error', 'Failed to retrieve printers.');
  }
});

ipcMain.on('get-app-version', (event) => {
  event.reply('send-app-version', app.getVersion());
});

ipcMain.on('print-file', (event, filePath) => {
  if (!fs.existsSync(filePath)) {
    dialog.showErrorBox('File Not Found', `The file at ${filePath} does not exist.`);
    return;
  }

  const tempDir = path.join(app.getPath('userData'), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempFilePath = path.join(tempDir, path.basename(filePath));
  fs.copyFileSync(filePath, tempFilePath);

  const printWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  printWindow.loadFile(tempFilePath);

  printWindow.webContents.once('did-finish-load', () => {
    printWindow.webContents.print({ silent: false, printBackground: true }, (success, errorType) => {
      if (!success) {
        console.error('Print failed:', errorType);
        event.reply('print-result', { success: false, error: errorType });
      } else {
        console.log('Print job sent successfully.');
        event.reply('print-result', { success: true });
      }
      printWindow.close();
    });
  });
});

ipcMain.on('show-error', (event, message) => {
  dialog.showMessageBox(mainWindow, { type: 'error', buttons: ['OK'], title: 'Error', message });
});

ipcMain.on('show-success', (event, message) => {
  dialog.showMessageBox(mainWindow, { type: 'info', buttons: ['OK'], title: 'Success', message });
});

autoUpdater.on('update-available', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['OK'],
    title: 'Update Available',
    message: 'A new version is available. Downloading now...',
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog
    .showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart', 'Later'],
      title: 'Update Ready',
      message: 'Update has been downloaded. It will be installed on restart.',
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
});

autoUpdater.on('error', (error) => {
  console.error('Auto-updater error:', error);
  dialog.showErrorBox('Update Error', `An error occurred while checking for updates: ${error.message}`);
});

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 2 * 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
