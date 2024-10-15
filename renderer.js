const JsBarcode = require('jsbarcode');
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Generate Barcode on Button Click
document.getElementById('generateBtn').addEventListener('click', async () => {
  const number = document.getElementById('inputNumber').value.trim();
  if (number) {
    try {
      // disable generate button and show loader
      document.getElementById('barcodePreview').innerHTML = '';
      document.getElementById('generateBtn').disabled = true;
      document.getElementById('loader').style.display = 'block';
      document.getElementById('printBtn').disabled = true;
      const canvas = document.createElement('canvas');

      JsBarcode(canvas, number, {
        format: 'CODE128',
        width: 1, // Adjusted for precise sizing
        height: 10, // Height set to 10 pixels
        displayValue: false, // Removes the footer text
        margin: 0 // Removes default margins
      });

      const desiredWidth = 120;
      const desiredHeight = 10;
      const resizedCanvas = document.createElement('canvas');
      resizedCanvas.width = desiredWidth;
      resizedCanvas.height = desiredHeight;
      const ctx = resizedCanvas.getContext('2d');

      ctx.drawImage(canvas, 0, 0, desiredWidth, desiredHeight);

      const barcodeDataURL = resizedCanvas.toDataURL();

      const response = await fetch(`https://api-bpe.mscapi.live/win/fetch/${number}`);
      const data = await response.json();

      if (data.success) {
        const product = data.data[0];

        const templatePath = path.join(__dirname, 'template', 'printLabel.html');
        fs.readFile(templatePath, 'utf-8', (err, template) => {
          if (err) {
            console.error('Error reading template:', err);
            ipcRenderer.send('show-error', 'Error generating barcode. Please try again.');
            return;
          }

          const labelHTML = template
            .replace('{barcode}', barcodeDataURL)
            .replace('{name}', product.name)
            .replace('{model}', product.Model)
            .replace('{input.voltage}', product.input.voltage)
            .replace('{input.current}', product.input.current)
            .replace('{pnCode}', product.pnCode)
            .replace('{serialNo}', product.serialNo)
            .replace('{madeBy}', product.madeBy);

          document.getElementById('barcodePreview').innerHTML = labelHTML;
        });
      } else {
        ipcRenderer.send('show-error', data.message);
      }
    } catch (error) {
      ipcRenderer.send('show-error', 'Failed to fetch data: ' + error.message);
    }

    document.getElementById('generateBtn').disabled = false;
    document.getElementById('loader').style.display = 'none';
    document.getElementById('printBtn').disabled = false;
  } else {
    ipcRenderer.send('show-error', 'Please enter IMEI or Serial');
  }
});