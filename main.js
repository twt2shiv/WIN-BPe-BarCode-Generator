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

// Handle request to get printer information
ipcMain.handle('get-printer-info', async () => {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    // Returning the printer list or a default message
    return printers.length > 0 ? printers[0].name : 'No Printers Found';
  } catch (error) {
    console.error('Failed to retrieve printers:', error);
    throw new Error('Failed to retrieve printers');
  }
});

// Handle request to get app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-server-status', async () => {
  try {
    const response = await axios.get('https://api-bpe.mscapi.live', {
      timeout: 30000, // 30-second timeout
    });
    return response.status === 200;
  } catch (error) {
    console.error('Server check failed:', error.message);
    return false;
  }
});

// Handle print file request
ipcMain.on('print-file', (event, filePath) => {
  const printWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    autoHideMenuBar: true,
    title: 'Print Preview',
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
    app.on('quit', () => {
      const outputDir = path.join(app.getPath('userData'), 'output');
      deleteFilesInDirectory(outputDir);
    });
  }
});

ipcMain.handle('get-output-path', () => {
  const outputDir = path.join(app.getPath('userData'), 'output');
  return outputDir; // Return the path to the renderer process
});

// Auto-update events
autoUpdater.on('update-available', (info) => {
  if (isDownloading) {
    console.log('Update is already downloading. Skipping new prompt.');
    return;
  }

  const newVersion = info.version;

  dialog
    .showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Download', 'Cancel'],
      title: 'Update Available',
      message: `A new version [${newVersion}] is available.\nDownloading now...`,
    })
    .then((result) => {
      if (result.response === 0) {
        isDownloading = true;
        autoUpdater.downloadUpdate();
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
  setInterval(() => autoUpdater.checkForUpdates(), 300 * 1000); // Check for updates every 5 minutes

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


const deleteFilesInDirectory = (dirPath) => {
  try {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      if (fs.lstatSync(filePath).isFile()) {
        fs.unlinkSync(filePath); // Delete the file
      }
    });
    console.log('All files deleted in the directory:', dirPath);
  } catch (err) {
    console.error('Error deleting files:', err);
  }
};
