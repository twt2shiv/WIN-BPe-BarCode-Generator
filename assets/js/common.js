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