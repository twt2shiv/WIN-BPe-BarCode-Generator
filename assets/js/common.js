const { ipcRenderer } = require('electron');

// Fetch and update app version
ipcRenderer.invoke('get-app-version').then((version) => {
    document.getElementById('appVersion').innerText = version || 'Unknown';
}).catch(() => {
    document.getElementById('appVersion').innerText = 'Unknown';
});

// Fetch and update server status
ipcRenderer.invoke('get-server-status').then((status) => {
    console.log('Server status:', status);
    document.getElementById('serverStatus').innerText = status ? 'Online' : 'Offline';
}).catch(() => {
    document.getElementById('serverStatus').innerText = 'Offline';
});


// Fetch and update printer status
ipcRenderer.invoke('get-printer-info')
    .then((printer) => {
        console.log('Printer status:', printer);
        document.getElementById('printerStatus').innerText = printer || 'NA';
    })
    .catch((error) => {
        console.error('Error fetching printer status:', error);
        document.getElementById('printerStatus').innerText = 'NA';
    });


// Minimize window functionality
document.getElementById('minimize-link').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

// Close window functionality
document.getElementById('close-link').addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

// Fetch and update network info (MAC address and IP address)
ipcRenderer.invoke('get-network-info').then((networkInfo) => {
    const { macAddress, ipAddress } = networkInfo;

    document.getElementById('macAddress').innerText = macAddress || 'N/A';
    document.getElementById('ipAddress').innerText = ipAddress || 'N/A';
}).catch(() => {
    document.getElementById('macAddress').innerText = 'N/A';
    document.getElementById('ipAddress').innerText = 'N/A';
});

function showProgress() {
    const progressBar = document.getElementById('downloadProgress');
    progressBar.style.display = 'block'; 
}

// Update the progress bar
function updateProgress(percent) {
    const progressBar = document.getElementById('downloadProgress');
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', percent); 
}

// Hide the progress bar when the download is complete
function hideProgress() {
    const progressBar = document.getElementById('downloadProgress');
    progressBar.style.display = 'none'; 
}

// Listen for progress updates from the main process
ipcRenderer.on('update-download-progress', (event, progress) => {
    const percent = Math.round(progress.percent); 
    showProgress(); 
    updateProgress(percent);
});

// Listen for the completion event
ipcRenderer.on('update-complete', () => {
    hideProgress(); 
});