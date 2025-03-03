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

    const code = document.querySelector('input[name="2fa"]').value;
    const submitButton = document.querySelector('button[type="submit"]');

    const payload = {
        otp: code
    };

    // Disable button and change text to "Please wait..."
    submitButton.disabled = true;
    const originalText = submitButton.textContent;
    submitButton.textContent = "Authenticating...";

    try {
        const response = await fetch( localStorage.getItem('server') + '/auth/verify', {
            method: 'POST',
            headers: {
                'Authorization': localStorage.getItem('authToken'), 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && result.success) {
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


