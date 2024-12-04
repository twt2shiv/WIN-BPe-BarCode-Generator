const JsBarcode = require('jsbarcode');
const { ipcRenderer } = require('electron');

// Generate Barcode on Button Click
document.getElementById('generateBarcodeBtn').addEventListener('click', async () => {
    const imeiNumber = document.getElementById('barcodeIMEINumber').value.trim();

    if (imeiNumber) {
        try {
            await generateBarcodeSticker(imeiNumber);
        } catch (error) {
            console.error('An error occurred while generating Barcode:', error);
            return ipcRenderer.send('show-error', 'An error occurred while generating Barcode');
        }
    } else {
        return ipcRenderer.send('show-error', 'Please enter IMEI');
    }
});

// Function to generate Barcode and display it
async function generateBarcodeSticker(number) {
    toggleLoader(true);

    try {
        // Fetch IMEI data from server
        const imeiAPIData = await getIMEIdataFromServer(number);

        // Check if the response is valid and if 'isOK' is true
        if (!imeiAPIData.success) {
            return ipcRenderer.send('show-error', 'IMEI data not valid or not OK');
        }

        // Generate the barcode directly into a canvas element
        const barcodeCanvas = document.getElementById('barcodeCanvas');

        // Clear any existing barcode
        barcodeCanvas.getContext('2d').clearRect(0, 0, barcodeCanvas.width, barcodeCanvas.height);

        // Use JsBarcode to generate the barcode and render it onto the canvas
        JsBarcode(barcodeCanvas, number, {
            format: 'CODE128',  // You can choose other formats if needed
            displayValue: true,  // Display the number under the barcode
        });

        // After barcode is generated, you can handle the print function here
        await printBarcode(barcodeCanvas);
    } catch (error) {
        console.error('An error occurred while generating Barcode:', error);
        return ipcRenderer.send('show-error', 'An error occurred while generating Barcode');
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

// Function to print the barcode canvas
async function printBarcode(barcodeCanvas) {
    try {
        // Convert the barcode canvas to an image and send it for printing
        const barcodeImageData = barcodeCanvas.toDataURL();

        // Send the image data to Electron to handle printing
        ipcRenderer.send('print-barcode', barcodeImageData);
    } catch (err) {
        console.error('An error occurred while printing Barcode:', err);
        return ipcRenderer.send('show-error', 'An error occurred while printing Barcode');
    }
}

// Function to toggle loader visibility
function toggleLoader(isLoading) {
    document.getElementById('loader').style.display = isLoading ? 'block' : 'none';
    document.getElementById('generateBarcodeBtn').disabled = isLoading;
}
