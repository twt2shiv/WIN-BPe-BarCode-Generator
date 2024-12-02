const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow; // Global variable for the main window

// Function to create a new window
function createWindow() {
  if (mainWindow) {
    return; // Prevent creating multiple windows
  }

  mainWindow = new BrowserWindow({
    width: 760,
    height: 500,
    resizable: false,
    autoHideMenuBar: true,
    frame: false,
    title: "Loading...",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('./pages/dashboard.html');

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null; // Clear the reference when the window is closed
  });
}

// Function to get MAC and IP address
function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  let macAddress = '';
  let ipAddress = '';

  // Iterate over all network interfaces and get the MAC and IP
  for (const iface in interfaces) {
    interfaces[iface].forEach((details) => {
      if (details.family === 'IPv4' && !details.internal) {
        ipAddress = details.address;
      }
      if (details.mac && !macAddress) {
        macAddress = details.mac; // Get the MAC address
      }
    });
  }
  return { macAddress, ipAddress };
}

// Handle request for getting MAC and IP address
ipcMain.handle('get-network-info', () => {
  return getNetworkInfo();
});

// Handle the 'get-app-version' request
ipcMain.handle('get-app-version', () => {
  const packagePath = path.join(__dirname, 'package.json');
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  return packageData.version;  // Return the version from package.json
});

// Handle request to get printer information
ipcMain.on('get-printer-info', async (event) => {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    event.sender.send('printer-info', printers);
  } catch (error) {
    console.error('Failed to retrieve printers:', error);
    event.sender.send('printer-info-error', 'Failed to retrieve printers.');
  }
});

// Handle request to get app version
ipcMain.on('get-app-version', (event) => {
  event.reply('send-app-version', app.getVersion());
});

// Handle print file request
ipcMain.on('print-file', (event, filePath) => {
  // Open the print file
  const printWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  printWindow.loadFile(filePath);

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


// Show error message dialog
ipcMain.on('show-error', (event, message) => {
  dialog.showMessageBox(mainWindow, { type: 'error', buttons: ['OK'], title: 'Error', message });
});

// Show success message dialog
ipcMain.on('show-success', (event, message) => {
  dialog.showMessageBox(mainWindow, { type: 'info', buttons: ['OK'], title: 'Success', message });
});

// Auto update events
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

// Get output path for the app
ipcMain.handle('get-output-path', () => {
  const outputDir = path.join(app.getPath('userData'), 'output');
  return outputDir; // Return the path to the renderer process
});

// Minimize window
ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

// Handle window close with confirmation
ipcMain.on('close-window', async () => {
  const response = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Cancel', 'YES - Please Close'],
    title: 'Confirm',
    message: 'Are you sure? You want to close the application?\n',
  });

  if (response.response === 1) {
    app.quit(); // Close the application if "OK" is selected
  }
});

// Initialize app and create the main window
app.whenReady().then(() => {
  createWindow();

  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 30 * 1000); // Check for updates every 30 seconds

  app.on('activate', () => {
    // Open a new window only if no other windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Ensure only one instance of the app runs
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit(); // Quit if another instance is already running
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}


// /pages
//   dashboard.html
//   sticker.html
// /template
// index.html
// main.js
// package.json
// preload.js
// assets/
//   build/
//   js/
//     sticker.js
// template/
//     printLabel.html
// Renderer.js