const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Generate Barcode on Button Click
document.getElementById('generateBarcodeBtn').addEventListener('click', async () => {
    const imeiNumber = document.getElementById('barcodeIMEINumber').value.trim();

    if (imeiNumber) {
        try {
            await generateBarcodeSticker(imeiNumber);
        } catch (error) {
            console.error('an error occured while generating Barcode 00:', error);
            return ipcRenderer.send('show-error', 'an error occured while Generating Barcode');
        } finally {
            toggleLoader(false);
        }
    } else {
        return ipcRenderer.send('show-error', 'Please enter IMEI');
    }
});

// Function to generate Barcode and display it
async function generateBarcodeSticker(number) {
    toggleLoader(true);
    try {
        const imeiAPIData = await getIMEIdataFromServer(number);

        if (!imeiAPIData.success) {
            return ipcRenderer.send('show-error', imeiAPIData.message);
        }
        const product = imeiAPIData.data;
        const fileName = product.txn;
        const labelHTML = createLabelHTML(product);

        downloadLabel(fileName, labelHTML);
        return;
    } catch (error) {
        console.error('an error occured while generating Barcode 11:', error);
        return ipcRenderer.send('show-error', 'an error occured while Generating Barcode');
    } finally {
        toggleLoader(false);
    }
}

// Function to fetch IMEI data
async function getIMEIdataFromServer(number) {
    const response = await fetch(`http://localhost:3005/win/QR/barcode/${number}`); // Dev
    // const response = await fetch(`https://api-bpe.mscapi.live/win/QR/barcode/${number}`); // PROD

    const data = await response.json();
    return data;
}

// Function to create label HTML from template
function createLabelHTML(product) {
    const templatePath = path.join(__dirname, './../template', 'barcodeSticker.html');
    const template = fs.readFileSync(templatePath, 'utf-8');
    return template
        .replace('{lineFirst}', product.lineFirst)
        .replace('{lineSecond}', product.lineSecond)
        .replace('{lineThird}', product.lineThird);
}


async function downloadLabel(fileName, labelHTML) {
    try {
        const outputDir = await ipcRenderer.invoke('get-output-path');
        const filePath = path.join(outputDir, `${fileName}_barcode-Label.html`);

        // Ensure the output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write the HTML file
        fs.writeFileSync(filePath, labelHTML);
        ipcRenderer.send('show-info', `File created successfully at ${filePath}`);

        // Automatically print the generated file
        printGeneratedFile(filePath);
        barcodeIMEINumber.value = '';
        return;
    } catch (err) {
        console.error('an error occured while saving Barcode sticker:', err);
        return ipcRenderer.send('show-error', 'an error occured while saving Barcode Sticker');
    }
}


// Function to print the generated file
function printGeneratedFile(filePath) {
    ipcRenderer.send('print-file', filePath);
}

// Function to toggle loader visibility
function toggleLoader(isLoading) {
    document.getElementById('loader').style.display = isLoading ? 'block' : 'none';
    document.getElementById('generateBarcodeBtn').disabled = isLoading;
}