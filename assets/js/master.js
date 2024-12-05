const JsBarcode = require('jsbarcode');
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

const form = document.getElementById("masterForm");
const generateButton = document.getElementById("generateMasterQRcode");
const cancelButton = document.getElementById("cancelForm");
const imeiInput = document.getElementById("imeiNumber");
const imeiList = document.getElementById("imeiList");
const totalScanned = document.getElementById("totalScanned");

const lotSize = 30;
const scannedIMEIs = new Set();

function updateTotalScanned() {
    totalScanned.textContent = `${scannedIMEIs.size}/${lotSize}`;
    imeiInput.disabled = scannedIMEIs.size >= lotSize;
}

imeiInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();

        const imei = imeiInput.value.trim();

        if (imei.length !== 15 || isNaN(imei)) {
            ipcRenderer.send("show-error", "Invalid IMEI. Please enter a 15-digit numeric IMEI.");
            imeiInput.value = "";
            return;
        }

        if (scannedIMEIs.has(imei)) {
            ipcRenderer.send("show-error", "Duplicate IMEI. Please scan a unique IMEI.");
            imeiInput.value = "";
            return;
        }

        if (scannedIMEIs.size >= lotSize) {
            ipcRenderer.send("show-error", `Lot size limit reached. You can only scan ${lotSize} IMEIs.`);
            imeiInput.value = "";
            return;
        }

        scannedIMEIs.add(imei);
        imeiList.value += imei + "\n";
        imeiInput.value = "";

        updateTotalScanned();
    }
});

form.addEventListener("reset", function () {
    scannedIMEIs.clear();
    imeiList.value = "";
    imeiInput.disabled = false;
    updateTotalScanned();
});

function validateForm() {
    const deviceModel = document.getElementById("deviceModel").value;
    const operator = document.getElementById("operator").value;

    let isValid = true;
    let errorMessage = "";
    let firstErrorField = null;

    if (deviceModel === "0") {
        errorMessage += "Please select a Device Model.\n";
        isValid = false;
        if (!firstErrorField) firstErrorField = document.getElementById("deviceModel");
    }

    if (operator === "0") {
        errorMessage += "Please select a SIM Operator.\n";
        isValid = false;
        if (!firstErrorField) firstErrorField = document.getElementById("operator");
    }

    if (scannedIMEIs.size === 0) {
        errorMessage += "No IMEIs scanned. Please scan at least one IMEI before submitting.\n";
        isValid = false;
    }

    if (!isValid) {
        ipcRenderer.send("show-error", errorMessage);
        if (firstErrorField) firstErrorField.focus();
    }

    return isValid;
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (validateForm()) {
        try {
            toggleLoader(true);

            const response = await fetch(`https://api-bpe.mscapi.live/win/QR/master`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    device: document.getElementById("deviceModel").value,
                    operator: document.getElementById("operator").value,
                    imeis: Array.from(scannedIMEIs),
                    nfcEnabled: document.getElementById("nfcStatus").checked,
                    adaptorIncluded: document.getElementById("adaptorStatus").checked,
                    simCardIncluded: document.getElementById("simStatus").checked,
                    qrEnabled: document.getElementById("qrStatus").checked,
                })
            });

            const apiResponse = await response.json();

            if (apiResponse.success && apiResponse.data.isOK) {
                console.log("API Response Data:", apiResponse.data);
                alert("Data submitted successfully.");
                form.reset();
            } else {
                ipcRenderer.send('show-error', apiResponse.message || 'Unknown error');
            }
            toggleLoader(false);
        } catch (error) {
            console.error("Error during form submission:", error);
            ipcRenderer.send('show-error', 'An error occurred during form submission.');
            toggleLoader(false);
        }
    }
});

function toggleLoader(isLoading) {
    const loader = document.getElementById('loader');
    if (loader) {
        generateButton.disabled = isLoading;
        cancelButton.disabled = isLoading;
        imeiList.style.display = isLoading ? 'none' : 'block';
        loader.style.display = isLoading ? 'block' : 'none';
    }
}

updateTotalScanned();