const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');

let mainWindow; // Global variable for the main window
let isDownloading = false; // Track whether a download is in progress

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

// Handle request to get app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
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

// Auto-update events
autoUpdater.on('update-available', () => {
  if (isDownloading) {
    console.log('Update is already downloading. Skipping new prompt.');
    return;
  }

  dialog
    .showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Download', 'Cancel'],
      title: 'Update Available',
      message: 'A new version is available. Do you want to download it now?',
    })
    .then((result) => {
      if (result.response === 0) {
        isDownloading = true; // Set the flag
        autoUpdater.downloadUpdate(); // Start downloading the update
      } else {
        console.log('User declined the update download.');
      }
    });
});

// Handle download progress
autoUpdater.on('download-progress', (progress) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-download-progress', progress);
  }
});

// Handle when the update is fully downloaded
autoUpdater.on('update-downloaded', () => {
  isDownloading = false; // Reset the flag when the download is complete

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-complete');
  }

  dialog
    .showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart', 'Later'],
      title: 'Update Ready',
      message: 'Update has been downloaded. It will be installed on restart.',
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(); // Restart the app and install the update
      }
    });
});

// Handle errors
autoUpdater.on('error', (error) => {
  console.error('Auto-updater error:', error);
  isDownloading = false; // Reset the flag if there's an error
});

// Initialize app and create the main window
app.whenReady().then(() => {
  createWindow();

  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 30 * 1000); // Check for updates every 30 seconds

  app.on('activate', () => {
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

