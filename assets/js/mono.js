const JsBarcode = require('jsbarcode');
const { ipcRenderer } = require('electron');

const form = document.getElementById("monoForm");
const generateButton = document.getElementById("generateMonoBarcode");

function validateForm() {
    const serialNumber = document.getElementById("serialNumber").value;
    const simNumber = document.getElementById("simNumber").value;
    const qrURL = document.getElementById("qrURL").value;
    const operator = document.getElementById("operator").value;

    let isValid = true;
    let errorMessage = "";
    let firstErrorField = null;

    if (serialNumber.length !== 11 || !/^\d{11}$/.test(serialNumber)) {
        errorMessage += "Invalid SR No. (must be 11 digits).\n";
        isValid = false;
        if (!firstErrorField) firstErrorField = document.getElementById("serialNumber");
    }

    if (simNumber.length < 19 || simNumber.length > 20) {
        errorMessage += "Invalid SIM ICCID (must be between 19 and 20 characters).\n";
        isValid = false;
        if (!firstErrorField) firstErrorField = document.getElementById("simNumber");
    }

    if (!qrURL) {
        errorMessage += "QR URL is required.\n";
        isValid = false;
        if (!firstErrorField) firstErrorField = document.getElementById("qrURL");
    }

    if (operator === "0") {
        errorMessage += "Please select a SIM operator.\n";
        isValid = false;
        if (!firstErrorField) firstErrorField = document.getElementById("operator");
    }

    if (!isValid) {
        ipcRenderer.send('show-error', errorMessage);
        if (firstErrorField) firstErrorField.focus(); 
    }

    return isValid;
}

form.addEventListener("submit", async function (event) {
    event.preventDefault(); 
    if (validateForm()) {
        try {
            const formData = {
                serialNumber: document.getElementById("serialNumber").value,
                simNumber: document.getElementById("simNumber").value,
                qrURL: document.getElementById("qrURL").value,
                operator: document.getElementById("operator").value
            };

            toggleLoader(true); 
            
            const response = await fetch(`http://localhost:3005/win/QR/mono/${formData.serialNumber}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    iccid: formData.simNumber,
                    qrurl: formData.qrURL,
                    operator: formData.operator
                })
            });

            const apiResponse = await response.json();

            if (apiResponse.success && apiResponse.data.isOK) {
                const data = apiResponse.data;

                console.log("API Response Data:", data);

                alert(`Success! ICCID: ${data.iccid}, QR URL: ${data.qrUrl}, Operator: ${data.operator}, Transaction ID: ${data.txn}`);
            } else {
                ipcRenderer.send('show-error', apiResponse.message || 'Unknown error');
            }

            toggleLoader(false); 
        } catch (error) {
            console.error("Error during form validation:", error);
            alert("An error occurred during form validation.");
            toggleLoader(false); 
        }
    }
});

function toggleLoader(isLoading) {
    const loader = document.getElementById('loader');
    if (loader) {
        generateButton.disabled = isLoading;
        loader.style.display = isLoading ? 'block' : 'none';
    }
}

window.addEventListener('load', function () {
    // No automatic validation, form validation will only happen when the user clicks submit
});
