const { ipcRenderer } = require('electron');

// Fetch and update app version
ipcRenderer.invoke('get-app-version').then((version) => {
    document.getElementById('appVersion').innerText = 'v:'+version || 'v: Unknown';
}).catch(() => {
    document.getElementById('appVersion').innerText = 'v: Unknown';
});

// Fetch and update server status
// ipcRenderer.invoke('get-server-status').then((status) => {
//     document.getElementById('serverStatus').innerText = status ? 'Online' : 'Offline';
// }).catch(() => {
//     document.getElementById('serverStatus').innerText = 'Offline';
// });


// Fetch and update printer status
// ipcRenderer.invoke('get-printer-info')
//     .then((printer) => {
//         document.getElementById('printerStatus').innerText = printer || 'NA';
//     })
//     .catch((error) => {
//         console.error('Error fetching printer status:', error);
//         document.getElementById('printerStatus').innerText = 'NA';
//     });


// Minimize window functionality
document.getElementById('minimize-link').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

// Close window functionality
document.getElementById('close-link').addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

// Fetch and update network info (MAC address and IP address)
// ipcRenderer.invoke('get-network-info').then((networkInfo) => {
//     const { macAddress, ipAddress } = networkInfo;

//     document.getElementById('macAddress').innerText = macAddress || 'N/A';
//     document.getElementById('ipAddress').innerText = ipAddress || 'N/A';
// }).catch(() => {
//     document.getElementById('macAddress').innerText = 'N/A';
//     document.getElementById('ipAddress').innerText = 'N/A';
// });


function updateTaskbarProgress(percent) {
    if (percent >= 0 && percent <= 100) {
        ipcRenderer.send('set-progress-bar', percent / 100); // Pass value between 0 and 1
    } else {
        ipcRenderer.send('set-progress-bar', -1); // Remove the progress bar
    }
}



let startTime;  // To track the start time

function showProgress() {
    const dashboardProgress = document.getElementById('dashboard-progress');
    const mainDashboard = document.getElementById('main-dashboard');
    
    dashboardProgress.style.display = 'block'; 
    mainDashboard.style.display = 'none'; 
}

function hideProgress() {
    const dashboardProgress = document.getElementById('dashboard-progress');
    const mainDashboard = document.getElementById('main-dashboard');

    dashboardProgress.style.display = 'none'; 
    mainDashboard.style.display = 'block'; 
}


// Update the progress bar and log data
function updateProgress(percent, bytesPerSecond, transferred, total) {
    const progressBar = document.getElementById('downloadProgress');
    const timeTrack = document.getElementById('timeTrack');

    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', percent); 

    // Calculate time elapsed and estimated remaining time
    const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
    const remainingBytes = total - transferred;
    const estimatedTime = bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : 0;

    // Update progress info
    document.getElementById('totalDownloadProgress').innerText = `${percent.toFixed(2)}%`;
    timeTrack.innerText = `Elapsed: ${elapsedTime.toFixed(2)}s | Remaining: ${estimatedTime.toFixed(2)}s`;

    // Update taskbar progress
    updateTaskbarProgress(percent);
}


// Listen for progress updates from the main process
ipcRenderer.on('update-download-progress', (event, progress) => {
    if (!startTime) startTime = Date.now(); // Initialize start time if not set

    const { bytesPerSecond, percent, total, transferred } = progress;
    if (total > 0) {
        showProgress();
        updateProgress(percent, bytesPerSecond, transferred, total);
    }
});

// Listen for the completion event
ipcRenderer.on('update-complete', () => {
    hideProgress();
    updateTaskbarProgress(-1);
    startTime = null;
});