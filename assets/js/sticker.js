const JsBarcode = require('jsbarcode');
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Generate Barcode on Button Click
document.getElementById('generateBtn').addEventListener('click', async () => {
    const number = document.getElementById('inputNumber').value.trim();

    if (number) {
        try {
            await generateBarcode(number);
        } catch (error) {
            console.error('an error occured while generating Sticker 00:', error);
            return ipcRenderer.send('show-error', 'an error occured while Generating Sticker');
        } finally {
            toggleLoader(false);
        }
    } else {
        return ipcRenderer.send('show-error', 'Please enter IMEI');
    }
});

// Function to generate barcode and display it
async function generateBarcode(number) {
    toggleLoader(true);
    try {
        const productData = await fetchProductData(number);

        if (!productData.success) {
            return ipcRenderer.send('show-error', productData.message);
        }
        const product = productData.data[0];
        const serialNo = product.serialNo;
        const barcodeDataURL = createBarcode(serialNo);
        const fileName = product.txn;

        const labelHTML = createLabelHTML(barcodeDataURL, product);

        downloadLabel(fileName, labelHTML);
        return;
    } catch (error) {
        console.error('an error occured while generating Sticker 11:', error);
        return ipcRenderer.send('show-error', 'an error occured while Generating Sticker');
    } finally {
        toggleLoader(false);
    }
}

// Function to create barcode and return the data URL
function createBarcode(number) {
    const canvas = document.createElement('canvas');

    JsBarcode(canvas, number, {
        format: 'CODE128',
        width: 2, // Set a larger width for better resolution
        height: 40, // Set a larger height for better resolution
        displayValue: false,
        margin: 0,
    });

    const desiredWidth = 120;
    const desiredHeight = 40;
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = desiredWidth;
    resizedCanvas.height = desiredHeight;

    const ctx = resizedCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, desiredWidth, desiredHeight);

    return resizedCanvas.toDataURL();
}

// Function to fetch product data
async function fetchProductData(number) {
    // const response = await fetch(`http://localhost:3005/win/QR/sticker/${number}`); // Dev
    const response = await fetch(`https://bpe-temp.mscorpres.net/win/QR/sticker/${number}`); // PROD

    const data = await response.json();

    return data;
}

// Function to create label HTML from template
function createLabelHTML(barcodeDataURL, product) {
    const templatePath = path.join(__dirname, './../template', 'stickerLabel.html');
    const template = fs.readFileSync(templatePath, 'utf-8');
    return template
        .replace('{barcode}', barcodeDataURL)
        .replace('{name}', product.name)
        .replace('{model}', product.model)
        .replace('{input.voltage}', product.input.voltage)
        .replace('{input.current}', product.input.current)
        .replace('{serialNo}', product.serialNo)
        .replace('{madeBy}', product.madeBy);
}


async function downloadLabel(fileName, labelHTML) {
    try {
        const outputDir = await ipcRenderer.invoke('get-output-path');
        const filePath = path.join(outputDir, `${fileName}_sticker-label.html`);

        console.log("==============", filePath);

        // Ensure the output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write the HTML file
        fs.writeFileSync(filePath, labelHTML);
        ipcRenderer.send('show-info', `File created successfully at ${filePath}`);

        // Automatically print the generated file
        printGeneratedFile(filePath);
        inputNumber.value = '';
        return;
    } catch (err) {
        console.error('an error occured while saving sticker:', err);
        return ipcRenderer.send('show-error', 'an error occured while saving sticker');
    }
}


// Function to print the generated file
function printGeneratedFile(filePath) {
    ipcRenderer.send('print-file', filePath);
}

// Function to toggle loader visibility
function toggleLoader(isLoading) {
    document.getElementById('loader').style.display = isLoading ? 'block' : 'none';
    document.getElementById('generateBtn').disabled = isLoading;
}