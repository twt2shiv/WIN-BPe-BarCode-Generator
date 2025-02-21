const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const { spawn } = require('child_process');


let mainWindow; // Global variable for the main window

// Function to create a new window
function createWindow() {
  if (mainWindow) {
    return; // Prevent creating multiple windows
  }

  mainWindow = new BrowserWindow({
    width: 850,
    height: 550,
    resizable: false,
    autoHideMenuBar: true,
    frame: false,
    title: "Refurb-Plus",
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('./pages/login.html');

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
  mainWindow.webContents.send('save-network-info', { macAddress, ipAddress });
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
    const response = await axios.get('https://tempbpe.mscorpres.net', {
      timeout: 30000, // 30-second timeout
    });
    return response.status === 200;
  } catch (error) {
    console.error('Server check failed:', error.message);
    return false;
  }
});



const acrobatExecutablePath = path.join('C:', 'Program Files', 'Adobe', 'Acrobat DC', 'Acrobat', 'Acrobat.exe');

ipcMain.on('print-file', async (event, filePath, pageSizeMM) => {
  console.log('Received print-file event with filePath:', filePath);

  const printWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Print Preview',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  printWindow.loadFile(filePath);

  printWindow.webContents.once('did-finish-load', async () => {
    try {
      const outputDir = path.join(app.getPath('userData'), 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate the PDF
      const pdfData = await printWindow.webContents.printToPDF({
        printBackground: true,
        landscape: false,
        marginsType: 0,
        pageSize: {
          width: pageSizeMM.width / 25.4,
          height: pageSizeMM.height / 25.4
        },
      });

      // Save the PDF to the output directory
      const pdfPath = path.join(outputDir, `${path.basename(filePath, '.html')}.pdf`);
      
      fs.writeFileSync(pdfPath, pdfData);

      // Check if Adobe Acrobat is installed
      if (!fs.existsSync(acrobatExecutablePath)) {
        dialog.showMessageBox({
          type: 'error',
          message: 'Adobe Acrobat Reader is not installed on your system.\nPlease install it to print the PDF automatically.',
          buttons: ['OK'],
        });
        return;
      }

      // Prepare and execute the print command
      const printProcess = spawn(acrobatExecutablePath, ['/t', pdfPath]);

      printProcess.stdout.on('data', (data) => {
        console.log('Adobe Acrobat stdout:', data.toString());
      });

      printProcess.stderr.on('data', (data) => {
        console.error('Adobe Acrobat stderr:', data.toString());
      });

      printProcess.on('close', (code) => {
        if (code !== 0) {
          event.reply('print-result', { success: true, message: 'PDF printed successfully.' });
        } else {
          console.error('Error printing the PDF, process exit code:', code);
          event.reply('print-result', { success: false, error: `Error printing the PDF. Process exit code: ${code}` });
        }
        printProcess.kill();
      });

      printProcess.on('error', (err) => {
        console.error('Error executing print process:', err);
        event.reply('print-result', { success: false, error: `Error executing print process: ${err.message}` });
      });

      printWindow.close();
    } catch (error) {
      console.error('Error generating or printing PDF:', error);
      event.reply('print-result', { success: false, error: error.message });
      printWindow.close();
    }
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
    message: 'Are you sure?',
  });

  if (response.response === 1) {
    app.on('quit', () => {
      const outputDir = path.join(app.getPath('userData'), 'output');
      deleteFilesInDirectory(outputDir);
    });
    app.quit();
  }
});


ipcMain.handle('get-output-path', () => {
  const outputDir = path.join(app.getPath('userData'), 'output');
  return outputDir; // Return the path to the renderer process
});

// Auto-updater events
autoUpdater.on('update-available', (info) => {
  const newVersion = info.version;
  const message = `A new version (${newVersion}) is available.\nDownload started in the background.`;

  showNotification('Update Available', message);

  autoUpdater.downloadUpdate();
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.setProgressBar(progressObj.percent / 100);
});

autoUpdater.on('update-downloaded', () => {
  const message = 'The update has been downloaded and is ready to install.\nRestart the app to apply the update.';

  showNotification('Update Ready', message);

  mainWindow.setProgressBar(1);

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Update Ready',
    message: 'The update has been downloaded and is ready to install.\nRestart to apply?',
  }).then((response) => {
    if (response.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  console.error('Error occurred during update:', err);
  mainWindow.setProgressBar(-1);
  showNotification('Update Error', `An error occurred during the update: ${err.message}`);
});

// End of Auto Updater

app.whenReady().then(() => {
  createWindow();
  detectAdobeAcrobat();
  autoUpdater.checkForUpdates();
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


// Handle save-excel message
ipcMain.on('save-excel', (event, { fileName, fileBuffer }) => {
  dialog.showSaveDialog({
    defaultPath: fileName,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  }).then(({ filePath }) => {
    if (filePath) {
      fs.writeFileSync(filePath, fileBuffer); // Save the file
      event.sender.send('show-success', `Excel file saved: ${filePath}`);
    }
  }).catch(err => {
    event.sender.send('show-error', `Error saving file: ${err.message}`);
  });
});

ipcMain.on('redirect-to-dashboard', (event) => {
  const currentWindow = BrowserWindow.getFocusedWindow();
  if (currentWindow) {
    currentWindow.loadFile('./pages/dashboard.html');
  }
});

// Function to show a notification
function showNotification(title, message) {
  const notification = new Notification({
    title: "Refurb-Plus - " + title,
    icon: path.join(__dirname, 'assets/build/favicon-1.ico'),
    silent: false,
    sound: 'default',
    body: message,
  });

  notification.show();
}