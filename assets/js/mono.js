const JsBarcode = require('jsbarcode');
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

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

            const response = await fetch(`https://api-bpe.mscapi.live/win/QR/mono/${formData.serialNumber}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    serial: formData.serialNumber,
                    sim: formData.simNumber,
                    qrurl: formData.qrURL,
                    operator: formData.operator
                })
            });

            const apiResponse = await response.json();

            if (apiResponse.success && apiResponse.data.isOK) {
                const data = apiResponse.data;

                console.log("API Response Data:", data);
                const serialBarcode = createBarcode(data.serialNo);
                const simBarcode = createBarcode(data.iccid);
                const qrBarcode = createBarcode(data.qrUrl);

                const labelHTML = await createLabelHTML(serialBarcode, simBarcode, qrBarcode, data);

                ipcRenderer.send('show-info', 'Print Sent to Printer');
                await downloadLabel(data.txn, labelHTML);
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
        loader.style.display = isLoading ? 'block' : 'none';
    }
}

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

async function createLabelHTML(serialBarcode, simBarcode, qrBarcode, data) {
    console.log("data", data);
    const templatePath = path.join(__dirname, './../template', 'monoSticker.html');
    const template = await fs.promises.readFile(templatePath, 'utf-8');
    return template
        .replace('{serialBarcode}', serialBarcode)
        .replace('{simBarcode}', simBarcode)
        .replace('{qrBarcode}', qrBarcode)
        .replace('{serialNo}', data.serialNo)
        .replace('{simNumer}', data.iccid)
        .replace('{operator}', data.operator)
        .replace('{qrURL}', data.qrUrl);
}

async function downloadLabel(fileName, labelHTML) {
    try {
        const outputDir = await ipcRenderer.invoke('get-output-path');
        const filePath = path.join(outputDir, `${fileName}_mono-label.html`);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        await fs.promises.writeFile(filePath, labelHTML);
        printGeneratedFile(filePath);
        form.reset();
        return;
    } catch (err) {
        console.error('An error occurred while saving the sticker:', err);
        ipcRenderer.send('show-error', 'An error occurred while saving the sticker.');
    }
}

function printGeneratedFile(filePath) {
    ipcRenderer.send('print-file', filePath);
}
