
// Minimize Button
document.getElementById('minimize-link').addEventListener('click', () => {
    window.electronAPI.minimizeWindow();
});

// Close Button with Confirmation
document.getElementById('close-link').addEventListener('click', () => {
    window.electronAPI.closeWindow();
});