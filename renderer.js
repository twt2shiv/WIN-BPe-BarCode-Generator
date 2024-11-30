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

  try {
    const product = await fetchProductData(number);
    if (product) {
      const serialNo = product.serialNo; // Use the serialNo from the API response
      const barcodeDataURL = createBarcode(serialNo); // Generate barcode using serialNo

      const labelHTML = createLabelHTML(barcodeDataURL, product);

      // Save the label and print
      downloadLabel(serialNo, labelHTML);
    } else {
      ipcRenderer.send('show-error', 'Failed to fetch product data.');
    }
  } catch (error) {
    ipcRenderer.send('show-error', 'Error generating barcode: ' + error.message);
  } finally {
    toggleLoader(false);
  }
}

// Function to create barcode and return the data URL
function createBarcode(number) {
  const canvas = document.createElement('canvas');

  // Generate the barcode on the original canvas
  JsBarcode(canvas, number, {
    format: 'CODE128',
    width: 2, // Set a larger width for better resolution
    height: 40, // Set a larger height for better resolution
    displayValue: false,
    margin: 0,
  });

  // Resize the barcode for consistent display
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
  // const response = await fetch(`http://localhost:3005/win/QR/fetch/${number}`); // Dev
  const response = await fetch(`https://api-bpe.mscapi.live/win/QR/fetch/${number}`); // Dev

  const data = await response.json();

  if (data.success) {
    return data.data[0];
  } else {
    inputNumber.value = '';
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

// Function to save label and trigger print
function downloadLabel(serialNo, labelHTML) {
  const filePath = path.join(__dirname, 'output', `${serialNo}_label.html`);

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  fs.writeFile(filePath, labelHTML, (err) => {
    if (err) {
      ipcRenderer.send('show-error', 'Error saving HTML file: ' + err.message);
    } else {
      ipcRenderer.send('show-info', `File created successfully at ${filePath}`);

      // Automatically print the generated file
      printGeneratedFile(filePath);
    }
  });
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

// Initial setup on window load
window.onload = () => {
  ipcRenderer.send('get-app-version');
};
