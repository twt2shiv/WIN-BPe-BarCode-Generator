const XLSX = require('xlsx');

document.addEventListener('DOMContentLoaded', () => {
    const masterQR = document.getElementById('masterQR');
    const serialList = document.getElementById('serialList');
    let lotCounter = 0;

    masterQR.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();

            const input = masterQR.value.trim();
            const numericInput = input.replace(/\D/g, '');

            masterQR.value = ''; // Clear the input field

            if (numericInput) {
                const chunks = numericInput.match(/.{1,11}/g);

                if (chunks) {
                    lotCounter++;

                    const lotHeader = `\n=================== LOT [${lotCounter}] | COUNT: [${chunks.length.toString().padStart(2, '0')}]\n`;
                    serialList.value += lotHeader;

                    chunks.forEach(chunk => {
                        serialList.value += chunk + '\n';
                    });
                }
            } else {
                ipcRenderer.send("show-error", "Please enter a valid numeric QR code.");
            }
        }
    });

    // Reset functionality
    const resetForm = document.getElementById('cancelForm');
    resetForm.addEventListener('click', () => {
        serialList.value = '';
        lotCounter = 0; 
    });

    // Generate Excel functionality
    const generateExcel = document.getElementById('generateExcel');
    generateExcel.addEventListener('click', () => {
        const content = serialList.value.trim();

        if (!content) {
            ipcRenderer.send("show-error", "No data to export.");
            return;
        }

        // Parse the content into a structured object
        const parseContentToObject = (data) => {
            const lots = data.split("===================")
                .filter(item => item.trim())
                .map(lot => {
                    const headerMatch = lot.match(/LOT \[(\d+)\] \| COUNT: \[(\d+)\]/);
                    if (!headerMatch) return null;
                    const [, lotNumber, count] = headerMatch;
                    const values = lot.split("\n").slice(1).map(item => item.trim()).filter(item => item);
                    return {
                        [`lot${lotNumber}`]: {
                            count: parseInt(count, 10),
                            values
                        }
                    };
                })
                .filter(item => item !== null);
            return Object.assign({}, ...lots);
        };

        const structuredData = parseContentToObject(content);

        const generateExcelFile = (data) => {
            const workbook = XLSX.utils.book_new();

            const allLotData = [];
            Object.keys(data).forEach(key => {
                allLotData.push([key.toUpperCase(), `Count: ${data[key].count}`]);
                allLotData.push(...data[key].values.map(value => [value]));
                allLotData.push([]); 
            });
            const allLotSheet = XLSX.utils.aoa_to_sheet(allLotData);
            XLSX.utils.book_append_sheet(workbook, allLotSheet, "ALL LOT");

            Object.keys(data).forEach(key => {
                const { count, values } = data[key];
                if (count > 1) {
                    const lotSheetData = values.map(value => [value]);
                    const lotSheet = XLSX.utils.aoa_to_sheet(lotSheetData);
                    XLSX.utils.book_append_sheet(workbook, lotSheet, `LOT ${key.replace('lot', '')}`);
                }
            });

            const fileName = `LOTS_${new Date().toISOString().slice(0, 10)}.xlsx`;
            const fileBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
            ipcRenderer.send('save-excel', { fileName, fileBuffer });
        };

        generateExcelFile(structuredData);
        resetForm.click();
    });

});
