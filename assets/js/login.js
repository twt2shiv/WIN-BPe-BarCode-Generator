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
    const server = document.querySelector('select[name="server"]').value;
    const submitButton = document.querySelector('button[type="submit"]');

    const payload = {
        username: username,
        password: password
    };

    // add session server
    if (server == '0') {
        ipcRenderer.send("show-error", "Please select a server"); return;
    } else {
        localStorage.setItem('server', server);
    }

    // Disable button and change text to "Please wait..."
    submitButton.disabled = true;
    const originalText = submitButton.textContent;
    submitButton.textContent = "Please wait...";

    try {
        const response = await fetch(server + '/auth/signin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && result.success) {
            if (result.isTwoStep === 'Y') {
                if (result.qrCode == 'Y') {
                    ipcRenderer.send('show-success', "on wef of 1st March 2025, this is necessary to implement Two-Factor Authentication (2FA) for security reasons.\nPlease login to our web-version and activate the Two-Factor Authentication.\n\nYour current login request will be ignored. - Pls contact your supervisor in case of any issues.");
                } else {
                    localStorage.setItem('authToken', result.token);
                    ipcRenderer.send('redirect-to-2fa'); // Redirect to 2FA
                }
            } else {
                localStorage.setItem('authToken', result.data.token);
                localStorage.setItem('userName', result.data.username);
                localStorage.setItem('userID', result.data.crn_id);

                ipcRenderer.send('redirect-to-dashboard'); // Redirect to Dashboard
            }
        } else {
            ipcRenderer.send("show-error", result.message);
        }
    } catch (error) {
        ipcRenderer.send("show-error", error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }


    // try {
    //     const response = await fetch( server + '/auth/signin', {
    //         method: 'POST',
    //         headers: {
    //             'Content-Type': 'application/json',
    //         },
    //         body: JSON.stringify(payload),
    //     });

    //     const result = await response.json();

    //     if (response.ok && result.success) {

    //         // ipcRenderer.send("show-success", "Welcome, "+result.data.username);
    //         localStorage.setItem('authToken', result.data.token);
    //         localStorage.setItem('userName', result.data.username);
    //         localStorage.setItem('userID', result.data.crn_id);

    //         ipcRenderer.send('redirect-to-dashboard'); 
    //     } else {
    //         ipcRenderer.send("show-error", result.message);
    //     }
    // } catch (error) {
    //     ipcRenderer.send("show-error", error.message);
    // } finally {
    //     submitButton.disabled = false;
    //     submitButton.textContent = originalText;
    // }
});


