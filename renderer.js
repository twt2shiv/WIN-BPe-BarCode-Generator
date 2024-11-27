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
  // const response = await fetch(`https://api-bpe.mscapi.live/win/fetch/${number}`);
  const response = await fetch(`http://localhost:3005/win/QR/fetch/${number}`); // dev
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
  const divElement = document.querySelector('#barcodePreview');

  if (divElement) {
    const htmlContent = divElement.outerHTML;

    const filePath = path.join(__dirname, 'output', `${labelHTML}_label.html`);

    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    fs.writeFile(filePath, htmlContent, (err) => {
      if (err) {
        ipcRenderer.send('show-error', 'Error saving HTML file: ' + err.message);
      } else {
        ipcRenderer.send('show-info', `file created successfully at ${filePath}`);
      }
    });
  } else {
    ipcRenderer.send('show-error', 'No content found to save as HTML.');
  }
}



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
