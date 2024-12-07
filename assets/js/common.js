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

ipcRenderer.on('update-download-progress', (event, progress) => {
    console.log('Received progress update:', progress);
    const { percent, elapsedTime, remainingTime, downloadSpeed, totalBytes, transferredBytes } = progress;

    const progressDiv = document.getElementById('dashboard-progress');
    if (progressDiv.style.display === 'none') {
        progressDiv.style.display = 'block';
    }

    const mainDashboard = document.getElementById('main-dashboard');
    mainDashboard.style.display = 'none';

    document.getElementById('downloadProgress').style.width = percent + '%';
    document.getElementById('totalDownloadProgress').innerText = `${percent.toFixed(0)}%`;

    const minutesElapsed = Math.floor(elapsedTime / 60);
    const secondsElapsed = elapsedTime % 60;
    const minutesRemaining = Math.floor(remainingTime / 60);
    const secondsRemaining = remainingTime % 60;

    document.getElementById('downloadStatus').innerText = `Total Time elapsed: ${minutesElapsed}:${secondsElapsed < 10 ? '0' + secondsElapsed : secondsElapsed} | estimated time to complete: ${minutesRemaining}:${secondsRemaining < 10 ? '0' + secondsRemaining : secondsRemaining}`;

    console.log('Download Speed:', downloadSpeed, 'bytes/sec');
});


ipcRenderer.on('update-complete', () => {
    // Hide the progress div
    document.getElementById('dashboard-progress').style.display = 'none';

    // Show the main dashboard content
    const mainDashboard = document.getElementById('main-dashboard');
    mainDashboard.style.display = 'block';
});

ipcRenderer.on('update-canceled', () => {
    document.getElementById('dashboard-progress').style.display = 'none';

    const mainDashboard = document.getElementById('main-dashboard');
    mainDashboard.style.display = 'block';
});
