const { ipcRenderer } = require('electron');

// Function to update the body class based on the network status
function updateBodyStatus() {
  const body = document.body;
  if (navigator.onLine) {
    body.classList.remove('disabled');
  } else {
    body.classList.add('disabled');
  }
}

window.addEventListener('online', updateBodyStatus);
window.addEventListener('offline', updateBodyStatus);

updateBodyStatus();

// Fetch and update app version
ipcRenderer.invoke('get-app-version').then((version) => {
  setTimeout(() => {
    document.getElementById('appVersion').innerText = 'v: ' + version;
  }, 500);
}).catch(() => {
  document.getElementById('appVersion').innerText = 'v: Unknown';
});

// Minimize window functionality
document.getElementById('minimize-link').addEventListener('click', () => {
  ipcRenderer.send('minimize-window');
});

// Close window functionality
document.getElementById('close-link').addEventListener('click', () => {
  ipcRenderer.send('close-window');
});

// Validate session
const authToken = localStorage.getItem('authToken');
const currentPage = window.location.pathname.split('/').pop();


// If token already exist login auto
if (!authToken) {
  if (currentPage !== 'login.html') {
    window.location.replace('login.html');
  }
} else {
  if (currentPage === 'login.html') {
    window.location.replace('dashboard.html');
  } else {
    const userName = localStorage.getItem('userName');
    if (userName) {
      document.getElementById('appUserName').innerText = `LoggedIn as: ${userName}`;
    } else {
      localStorage.clear();
      window.location.replace('login.html');
    }
  }
}


ipcRenderer.on('save-network-info', (event, data) => {
  const { macAddress, ipAddress } = data;
  localStorage.setItem('userIP', ipAddress);
  localStorage.setItem('userMAC', macAddress);
});