const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

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
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    const response = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Cancel', 'OK'],
      title: 'Confirm',
      message: 'Are you sure you want to close the application?'
    });
    if (response === 0) {
      event.preventDefault(); // Prevent the window from closing
    }
  });
}

// Send printer information to the renderer process
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
  const appVersion = app.getVersion();
  event.reply('send-app-version', appVersion);
});
// Auto updater events
autoUpdater.on('update-available', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['OK'],
    title: 'Update Available',
    message: 'A new version is available. Downloading now...'
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Update Ready',
    message: 'Update has been downloaded. It will be installed on restart.'
  }).then((result) => {
    if (result.response === 0) { // If 'Restart' button is clicked
      autoUpdater.quitAndInstall(); // Restart and install the update
    }
  });
});

// Check for updates on app start
app.whenReady().then(() => {
  createWindow();

  // Check for updates immediately
  autoUpdater.checkForUpdates();

  // Periodic check for updates (optional)
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 60000); // Check every minute

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handle Print Request from Renderer
ipcMain.on('print-label', (event, labelContent) => {
  // Create a hidden window to print the label
  let printWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Hide the window
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load a blank HTML with the label content
  printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
    <html>
      <head>
        <title>Print Label</title>
        <link rel="stylesheet" href="file://${path.join(__dirname, 'assets', 'styles.css')}">
      </head>
      <body>
        ${labelContent}
      </body>
    </html>
  `));

  // Once the content is loaded, initiate printing
  printWindow.webContents.on('did-finish-load', () => {
    printWindow.webContents.print({
      silent: false, // Set to true for silent printing
      printBackground: true
    }, (success, errorType) => {
      if (!success) {
        console.error('Failed to print:', errorType);
        event.reply('print-result', { success: false, error: errorType });
      } else {
        console.log('Print job sent successfully.');
        event.reply('print-result', { success: true });
      }
      printWindow.close();
    });
  });
});

// Handle Show Error Dialog
ipcMain.on('show-error', (event, message) => {
  dialog.showMessageBox(mainWindow, {
    type: 'error',
    buttons: ['OK'],
    title: 'Error',
    message: message
  });
});

// Handle Show Success Dialog
ipcMain.on('show-success', (event, message) => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['OK'],
    title: 'Success',
    message: message
  });
});
