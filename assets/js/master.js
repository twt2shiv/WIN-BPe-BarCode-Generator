const JsBarcode = require('jsbarcode');
const QRCode = require('qrcode');
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

            // AND the repsonse is like as below
            // {
            //     "success": true,
            //     "data": {
            //         "isOK": true,
            //         "deviceModel": "MOD1",
            //         "imeis": [
            //             "864946060293114",
            //             "860931067338884"
            //         ],
            //         "serials": [
            //             "00049769791",
            //             "00067570289"
            //         ],
            //         "nfcEnabled": "Yes",
            //         "adaptorIncluded": "Yes",
            //         "simCardIncluded": "No",
            //         "qrEnabled": "No",
            //         "operator": "Airtel",
            //         "boxNumber": "BOX/05122024/213552/76737/A",
            //         "txnDt": "05-12-2024 21:35:52",
            //         "txn": "67b3def3-b973-4d6d-bd21-da074c96e16d"
            //     },
            //     "status": "success"
            // }

            // I want to create the barcode of boxNumber , qrcode of the data [serial number, imeis, serials]

            createBarcode
            if (apiResponse.success && apiResponse.data.isOK) {
                const data = apiResponse.data;
                // my approch was like this
                const boxBarcode = createBarcode(data.boxNumber);
                // for qr code I dont know the code
                const labelHTML = await createLabelHTML(data);

                ipcRenderer.send('show-info', 'Print Sent to Printer');
                await downloadLabel(data.txn, labelHTML);
                // form.reset();
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
            width: 200,  // Width of the QR Code
            margin: 1    // Margin around QR Code
        }, function (err, url) {
            if (err) reject(err);
            resolve(url);  // Return the QR code as a Data URL
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