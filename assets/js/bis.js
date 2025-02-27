const fs = require('fs');
const path = require('path');

// Generate BIS on Button Click
document.getElementById('generateBISBtn').addEventListener('click', async () => {
    const imeiNumber = document.getElementById('bisIMEINumber').value.trim();

    if (imeiNumber) {
        try {
            await generateSticker(imeiNumber);
        } catch (error) {
            console.error('an error occured while generating BIS 00:', error);
            return ipcRenderer.send('show-error', 'an error occured while Generating BIS');
        } finally {
            toggleLoader(false);
        }
    } else {
        return ipcRenderer.send('show-error', 'Please enter IMEI');
    }
});

// Function to generate BIS and display it
async function generateSticker(number) {
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
        console.error('an error occured while generating BIS 11:', error);
        return ipcRenderer.send('show-error', 'an error occured while Generating BIS');
    } finally {
        toggleLoader(false);
    }
}

// Function to fetch IMEI data
async function getIMEIdataFromServer(number) {
    const response = await fetch(localStorage.getItem('server') + `/win/QR/bis/${number}`, {
        method: 'GET',
        headers: {
            'x-token': localStorage.getItem('authToken'),
            'x-user-id': localStorage.getItem('userID'),
            'x-mac-address': localStorage.getItem('userMAC'),
            'x-ip-address': localStorage.getItem('userIP')
        },
    });

    const data = await response.json();

    return data;
}

// Function to create label HTML from template
function createLabelHTML(product) {
    const templatePath = path.join(__dirname, './../template', 'bisSticker.html');
    const template = fs.readFileSync(templatePath, 'utf-8');
    return template
        .replace('{lineFirst}', product.lineFirst)
        .replace('{lineSecond}', product.lineSecond)
        .replace('{lineThird}', product.lineThird);
}


async function downloadLabel(fileName, labelHTML) {
    try {
        const outputDir = await ipcRenderer.invoke('get-output-path');
        const filePath = path.join(outputDir, `${fileName}_BIS-Label.html`);
        const pageSizeMM = { width: 29, height: 29 };

        // Ensure the output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write the HTML file
        fs.writeFileSync(filePath, labelHTML);
        ipcRenderer.send('show-info', `File created successfully at ${filePath}`);

        // Automatically print the generated file
        printGeneratedFile(filePath, pageSizeMM);
        bisIMEINumber.value = '';
        bisIMEINumber.focus();
        return;
    } catch (err) {
        console.error('an error occured while saving BIS sticker:', err);
        return ipcRenderer.send('show-error', 'an error occured while saving BIS sticker');
    }
}


// Function to print the generated file
function printGeneratedFile(filePath, pageSizeMM) {
    ipcRenderer.send('print-file', filePath, pageSizeMM);
}

// Function to toggle loader visibility
function toggleLoader(isLoading) {
    document.getElementById('loader').style.display = isLoading ? 'block' : 'none';
    document.getElementById('generateBISBtn').disabled = isLoading;
}

ipcRenderer.on('print-result', (event, result) => {
    if (result.success) {
        bisIMEINumber.focus();
    } else {
        console.error(result.error);
    }
});