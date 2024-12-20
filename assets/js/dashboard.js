// Fetch and update server status
ipcRenderer.invoke('get-server-status').then((status) => {
    document.getElementById('serverStatus').innerText = status ? 'Online' : 'Offline';
}).catch(() => {
    document.getElementById('serverStatus').innerText = 'Offline';
});


// Fetch and update printer status
ipcRenderer.invoke('get-printer-info')
    .then((printer) => {
        document.getElementById('printerStatus').innerText = printer || 'NA';
    })
    .catch((error) => {
        console.error('Error fetching printer status:', error);
        document.getElementById('printerStatus').innerText = 'NA';
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