const JsBarcode = require('jsbarcode');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const LOT_SIZE = 30;

const form = document.getElementById("masterForm");
const generateButton = document.getElementById("generateMasterQRcode");
const cancelButton = document.getElementById("cancelForm");
const serialInput = document.getElementById("serialNumber");
const serialContainer = document.getElementById("serialContainer");
const totalScanned = document.getElementById("totalScanned");
const loader = document.getElementById("loader");

const scannedSerials = new Set();

// Helper Functions
function updateTotalScanned() {
    totalScanned.textContent = `${scannedSerials.size}/${LOT_SIZE}`;
    serialInput.disabled = scannedSerials.size >= LOT_SIZE;
}

function showError(message) {
    ipcRenderer.send("show-error", message);
}

function toggleLoader(isLoading) {
    if (loader) {
        generateButton.disabled = isLoading;
        cancelButton.disabled = isLoading;
        serialContainer.style.display = isLoading ? 'none' : 'block';
        loader.style.display = isLoading ? 'block' : 'none';
    }
}

function renderSerialList() {
    serialContainer.innerHTML = "";

    scannedSerials.forEach(serial => {
        const serialItem = document.createElement("div");
        serialItem.className = "serial-item d-flex align-items-center justify-content-between";

        const serialText = document.createElement("span");
        serialText.textContent = serial;

        const removeButton = document.createElement("button");
        removeButton.innerHTML = ' <i class="fa fa-trash-o"></i> ';
        removeButton.className = "btn btn-outline-danger btn-icon mg-r-5";
        removeButton.style.padding = "1px 3px 0px 3px";
        removeButton.title = "Remove Serial";
        removeButton.addEventListener("click", () => {
            scannedSerials.delete(serial);
            renderSerialList();
            updateTotalScanned();
        });

        serialItem.appendChild(serialText);
        serialItem.appendChild(removeButton);
        serialContainer.appendChild(serialItem);
    });
}


// Event Listeners
serialInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        const serial = serialInput.value.trim();

        if (serial.length !== 11 || isNaN(serial)) {
            showError("Invalid Serial. Please enter an 11-digit numeric Serial.");
            serialInput.value = "";
            return;
        }

        if (scannedSerials.has(serial)) {
            showError("Duplicate Serial. Please scan a unique Serial.");
            serialInput.value = "";
            return;
        }

        if (scannedSerials.size >= LOT_SIZE) {
            showError(`Lot size limit reached. You can only scan ${LOT_SIZE} Serials.`);
            serialInput.value = "";
            return;
        }

        scannedSerials.add(serial);
        serialInput.value = "";

        renderSerialList();
        updateTotalScanned();

        // Auto-submit when 30 serials are scanned
        if (scannedSerials.size === LOT_SIZE) {
            generateButton.click();
        }
    }
});

form.addEventListener("reset", function () {
    scannedSerials.clear();
    renderSerialList();
    serialInput.disabled = false;
    updateTotalScanned();
});

form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!validateForm()) return;

    try {
        toggleLoader(true);

        const response = await fetch(localStorage.getItem('server') + "/win/QR/master", {
            method: 'POST',
            headers: {
                'x-token': localStorage.getItem('authToken'),
                'x-user-id': localStorage.getItem('userID'),
                'x-mac-address': localStorage.getItem('userMAC'),
                'x-ip-address': localStorage.getItem('userIP'),
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
        if (apiResponse.success && apiResponse.data.isOK) {
            const labelHTML = await createLabelHTML(apiResponse.data);
            ipcRenderer.send('show-info', 'Print Sent to Printer');
            await downloadLabel(apiResponse.data.txn, labelHTML);
            serialInput.focus();
            form.reset();
        } else {
            console.error("API response:", apiResponse);
            showError(apiResponse.message || 'Unknown error');
        }
    } catch (error) {
        console.error("Error during form submission:", error);
        showError("An error occurred during form submission.");
    } finally {
        toggleLoader(false);
    }
});

// Validation
function validateForm() {
    const deviceModel = document.getElementById("deviceModel").value;
    const operator = document.getElementById("operator").value;

    let errorMessage = "";
    if (deviceModel === "0") errorMessage += "Please select a Device Model.\n";
    if (operator === "0") errorMessage += "Please select a SIM Operator.\n";
    if (scannedSerials.size === 0) errorMessage += "No Serials scanned. Please scan at least one Serial before submitting.\n";

    if (errorMessage) {
        showError(errorMessage.trim());
        return false;
    }
    return true;
}

// QR and Barcode Helpers
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
    return QRCode.toDataURL(data.join('\n\r'), { width: 200, margin: 1 });
}

async function createLabelHTML(data) {
    const boxQRCode = await createQRCode(data.serials);
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
        .replace('{boxQRcode}', boxQRCode)
        .replace('{boxNumber}', data.boxNumber)
        .replace('{lotSize}', data.lotLength);
}

async function downloadLabel(fileName, labelHTML) {
    try {
        const outputDir = await ipcRenderer.invoke('get-output-path');
        const filePath = path.join(outputDir, `${fileName}_master-label.html`);
        const pageSizeMM = { width: 100, height: 150 };


        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        await fs.promises.writeFile(filePath, labelHTML);
        printGeneratedFile(filePath, pageSizeMM);
        form.reset();
        serialInput.focus();
        return;
    } catch (err) {
        console.error('Error saving label:', err);
        showError("An error occurred while saving the label.");
    }
}

function printGeneratedFile(filePath, pageSizeMM) {
    ipcRenderer.send('print-file', filePath, pageSizeMM);
}

ipcRenderer.on('print-result', (event, result) => {
    if (result.success) {
        console.log(result.message);
        serialInput.focus();
    } else {
        console.error(result.error);
    }
});

// Initialize
updateTotalScanned();
