const JsBarcode = require('jsbarcode');
const QRCode = require('qrcode');
const { ipcRenderer } = require('electron');
const path = require('path');

const fs = require('fs');

const form = document.getElementById("masterForm");
const generateButton = document.getElementById("generateMasterQRcode");
const cancelButton = document.getElementById("cancelForm");
const serialInput = document.getElementById("serialNumber");
const serialList = document.getElementById("serialList");
const totalScanned = document.getElementById("totalScanned");

const lotSize = 30;
const scannedSerials = new Set();

function updateTotalScanned() {
    totalScanned.textContent = `${scannedSerials.size}/${lotSize}`;
    serialInput.disabled = scannedSerials.size >= lotSize;
}

serialInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();

        const serial = serialInput.value.trim();

        if (serial.length !== 11 || isNaN(serial)) {
            ipcRenderer.send("show-error", "Invalid Serial. Please enter a 11-digit numeric Serial.");
            serialInput.value = "";
            return;
        }

        if (scannedSerials.has(serial)) {
            ipcRenderer.send("show-error", "Duplicate Serial. Please scan a unique Serial.");
            serialInput.value = "";
            return;
        }

        if (scannedSerials.size >= lotSize) {
            ipcRenderer.send("show-error", `Lot size limit reached. You can only scan ${lotSize} Serials.`);
            serialInput.value = "";
            return;
        }

        scannedSerials.add(serial);
        serialList.value += serial + "\n";
        serialInput.value = "";

        updateTotalScanned();
    }
});

form.addEventListener("reset", function () {
    scannedSerials.clear();
    serialList.value = "";
    serialInput.disabled = false;
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

    if (scannedSerials.size === 0) {
        errorMessage += "No Serials scanned. Please scan at least one Serial before submitting.\n";
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
                    serials: Array.from(scannedSerials),
                    nfcEnabled: document.getElementById("nfcStatus").checked,
                    adaptorIncluded: document.getElementById("adaptorStatus").checked,
                    simCardIncluded: document.getElementById("simStatus").checked,
                    qrEnabled: document.getElementById("qrStatus").checked,
                })
            });

            const apiResponse = await response.json();

            createBarcode
            if (apiResponse.success && apiResponse.data.isOK) {
                const data = apiResponse.data;
                const labelHTML = await createLabelHTML(data);
                ipcRenderer.send('show-info', 'Print Sent to Printer');
                await downloadLabel(data.txn, labelHTML);
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
        serialList.style.display = isLoading ? 'none' : 'block';
        loader.style.display = isLoading ? 'block' : 'none';
    }
}

updateTotalScanned();

function createBarcode(content) {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, content, {
        format: 'CODE128',
        width: 2,
        height: 40,
        displayValue: false,
        margin: 0,
    });

    return canvas.toDataURL();
}

function createQRCode(data) {
    return new Promise((resolve, reject) => {
        const qrData = JSON.stringify({
            imeis: data.imeis,
            serials: data.serials
        });

        QRCode.toDataURL(qrData, {
            width: 200,  
            margin: 1   
        }, function (err, url) {
            if (err) reject(err);
            resolve(url);  
        });
    });
}

async function createLabelHTML(data) {
    const boxBarcode = createBarcode(data.boxNumber);
    const boxQRCode = await createQRCode(data);

    const templatePath = path.join(__dirname, './../template', 'masterSticker.html');
    const template = await fs.promises.readFile(templatePath, 'utf-8');
    return template
        .replace('{deviceModel}', data.deviceModel)
        .replace('{nfcEnabled}', data.nfcEnabled)
        .replace('{adapterStatus}', data.adaptorIncluded)
        .replace('{qrStatus}', data.qrEnabled)
        .replace('{simStatus}', data.simCardIncluded)
        .replace('{simOperator}', data.operator)
        .replace('{boxDate}', data.txnDt)
        .replace('{boxBarcode}', boxBarcode)
        .replace('{boxQRcode}', boxQRCode);
}

async function downloadLabel(fileName, labelHTML) {
    try {
        const outputDir = await ipcRenderer.invoke('get-output-path');
        const filePath = path.join(outputDir, `${fileName}_master-label.html`);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        await fs.promises.writeFile(filePath, labelHTML);
        printGeneratedFile(filePath);
        form.reset();
        return;
    } catch (err) {
        console.error('An error occurred while saving the label:', err);
        ipcRenderer.send('show-error', 'An error occurred while saving the label.');
    }
}

function printGeneratedFile(filePath) {
    ipcRenderer.send('print-file', filePath);
}