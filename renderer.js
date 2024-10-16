const JsBarcode = require('jsbarcode');
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const html2canvas = require('html2canvas');
const { jsPDF } = require('jspdf');

// Generate Barcode on Button Click
document.getElementById('generateBtn').addEventListener('click', async () => {
    const number = document.getElementById('inputNumber').value.trim();

    if (number) {
        try {
            await generateBarcode(number);
        } catch (error) {
            ipcRenderer.send('show-error', 'Error generating barcode: ' + error.message);
        } finally {
            toggleLoader(false);
        }
    } else {
        ipcRenderer.send('show-error', 'Please enter IMEI or Serial');
    }
});

// Function to generate barcode and display it
async function generateBarcode(number) {
    toggleLoader(true);

    const barcodeDataURL = createBarcode(number);

    const product = await fetchProductData(number);
    if (product) {
        const labelHTML = createLabelHTML(barcodeDataURL, product);
        document.getElementById('barcodePreview').innerHTML = labelHTML;

        // Allow user to download the label
        downloadLabel(number);
    }
}

// Function to create barcode and return the data URL
function createBarcode(number) {
    const canvas = document.createElement('canvas');

    JsBarcode(canvas, number, {
        format: 'CODE128',
        width: 1,
        height: 10,
        displayValue: false,
        margin: 0
    });

    const desiredWidth = 120;
    const desiredHeight = 10;
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = desiredWidth;
    resizedCanvas.height = desiredHeight;

    const ctx = resizedCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0, desiredWidth, desiredHeight);

    return resizedCanvas.toDataURL();
}

// Function to fetch product data
async function fetchProductData(number) {
    const response = await fetch(`https://api-bpe.mscapi.live/win/fetch/${number}`);
    const data = await response.json();

    if (data.success) {
        return data.data[0];
    } else {
        ipcRenderer.send('show-error', data.message);
        return null;
    }
}

// Function to create label HTML from template
function createLabelHTML(barcodeDataURL, product) {
    const templatePath = path.join(__dirname, 'template', 'printLabel.html');
    const template = fs.readFileSync(templatePath, 'utf-8');

    return template
        .replace('{barcode}', barcodeDataURL)
        .replace('{name}', product.name)
        .replace('{model}', product.model)
        .replace('{input.voltage}', product.input.voltage)
        .replace('{input.current}', product.input.current)
        .replace('{pnCode}', product.pnCode)
        .replace('{serialNo}', product.serialNo)
        .replace('{madeBy}', product.madeBy);
}

// Function to download label as PNG
function downloadLabel(labelHTML) {
  // Access the specific div inside barcodePreview
  const divElement = document.querySelector('#barcodePreview > div');

  // Use html2canvas to capture the div as a canvas
  html2canvas(divElement).then((canvas) => {
    const imgData = canvas.toDataURL('image/png'); // Get the image data

    // Create a new PDF document
    const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' for A4 size

    // Define the image dimensions
    const imgWidth = 39.80; // width in mm
    const imgHeight = 18.50; // height in mm

    // Center the image in the PDF page
    const xOffset = (pdf.internal.pageSize.getWidth() - imgWidth) / 2; // Centering horizontally
    const yOffset = (pdf.internal.pageSize.getHeight() - imgHeight) / 2; // Centering vertically

    // Add the image to the PDF at the calculated offsets
    pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
    pdf.save(`${labelHTML}_label.pdf`); // Save the PDF with the product name
  });
}

// function downloadLabel(labelHTML) {
//     // Access the specific div inside barcodePreview
//     const divElement = document.querySelector('#barcodePreview > div');

//     // Use html2canvas to capture the div as a canvas
//     html2canvas(divElement).then((canvas) => {
//         const imgData = canvas.toDataURL('image/png'); // Get the image data

//         // Create a new PDF document
//         const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' for A4 size
//         const imgWidth = 210; // A4 width in mm
//         const imgHeight = (canvas.height * imgWidth) / canvas.width; // Maintain aspect ratio

//         // Add the image to the PDF
//         pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
//         pdf.save(`${labelHTML}_label.pdf`); // Save the PDF with the product name
//     });
// }


// Function to toggle loader visibility
function toggleLoader(isLoading) {
    document.getElementById('loader').style.display = isLoading ? 'block' : 'none';
    document.getElementById('generateBtn').disabled = isLoading;
    document.getElementById('printBtn').disabled = isLoading;
}

// Show printer information
function showPrinterInfo(printers) {
    if (printers && printers.length > 0) {
        const defaultPrinter = printers.find(printer => printer.isDefault) || printers[0];
        document.getElementById('printerName').innerHTML = `<strong>Name: </strong> ${defaultPrinter.name || 'N/A'}`;
        document.getElementById('printerDefault').innerHTML = `<strong>Default: </strong> ${defaultPrinter.isDefault ? 'Yes' : 'No'}`;
    } else {
        ipcRenderer.send('show-error', 'No printers found.');
    }
}

// Handle Printer Information from Main Process
ipcRenderer.on('printer-info', (event, printers) => {
    showPrinterInfo(printers);
});

// Update the version in the HTML when the version is received
ipcRenderer.on('send-app-version', (event, version) => {
    document.getElementById('appVersion').innerHTML = `v${version}`;
});

// Initial setup on window load
window.onload = () => {
    ipcRenderer.send('get-printer-info');
    ipcRenderer.send('get-app-version');
};
