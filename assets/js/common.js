const { ipcRenderer } = require('electron');

// Fetch and update app version
ipcRenderer.invoke('get-app-version').then((version) => {
    document.getElementById('appVersion').innerText = version || 'Unknown';
}).catch(() => {
    document.getElementById('appVersion').innerText = 'Unknown';
});

// Fetch and update server status
ipcRenderer.invoke('get-server-status').then((status) => {
    document.getElementById('serverStatus').innerText = status ? 'Online' : 'Offline';
}).catch(() => {
    document.getElementById('serverStatus').innerText = 'Offline';
});

// Fetch and update printer status
ipcRenderer.invoke('get-printer-status').then((printer) => {
    document.getElementById('printerStatus').innerText = printer || 'NA';
}).catch(() => {
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