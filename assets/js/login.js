const { ipcRenderer } = require('electron');

const loginForm = document.querySelector('form');

// Minimize window functionality
document.getElementById('minimize-link').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
  });
  
  // Close window functionality
  document.getElementById('close-link').addEventListener('click', () => {
    ipcRenderer.send('close-window');
  });


loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.querySelector('input[name="username"]').value;
    const password = document.querySelector('input[name="password"]').value;
    const submitButton = document.querySelector('button[type="submit"]');

    const payload = {
        username: username,
        password: password
    };

    // Disable button and change text to "Please wait..."
    submitButton.disabled = true;
    const originalText = submitButton.textContent;
    submitButton.textContent = "Please wait...";

    try {
        const response = await fetch('https://tempbpe.mscorpres.net/auth/signin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // ipcRenderer.send("show-success", "Welcome, "+result.data.username);
            localStorage.setItem('authToken', result.data.token);
            localStorage.setItem('userName', result.data.username);
            localStorage.setItem('userID', result.data.crn_id);

            ipcRenderer.send('redirect-to-dashboard'); 
        } else {
            ipcRenderer.send("show-error", result.message);
        }
    } catch (error) {
        ipcRenderer.send("show-error", error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
});


