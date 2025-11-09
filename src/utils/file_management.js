import { readCSV } from "./Helper.js";
import xlsx from "xlsx";
import logger from "./logger.js";
import path from "path";


export function readExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    return data.map(row => {
        const cleanRow = {};
        Object.keys(row).forEach(key => {
            const cleanKey = key.trim();
            cleanRow[cleanKey] = typeof row[key] === "string" ? row[key].trim() : row[key];
        });
        return cleanRow;
    });
}

export function findValue(data, possibleKeys) {
    for (const key of possibleKeys) {
        if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
            return data[key];
        }
    }
    return "";
}

export function detectFileType(dataRow) {
    if (!dataRow || typeof dataRow !== 'object') {
        return 'unknown';
    }

    const keys = Object.keys(dataRow).map(k => k.toLowerCase().trim());
    const values = Object.values(dataRow).map(v =>
        typeof v === 'string' ? v.toLowerCase() : ''
    );

    // 🔹 ตรวจสอบประเภทไฟล์หน่วยการเรียน
    const hasUnitKeys = keys.some(k =>
        k.includes('unit_name') ||
        k.includes('ชื่อหน่วย') ||
        k.includes('หน่วยการเรียน')
    );

    const hasOutcomeKeys = keys.some(k =>
        k.includes('outcome') ||
        k.includes('ผลลัพธ์') ||
        k.includes('learning') && k.includes('outcome')
    );

    const hasTpqiKeys = keys.some(k =>
        k.includes('tpqi') ||
        k.includes('ตัวบ่งชี้') ||
        k.includes('competency')
    );

    const hasObjectiveKeys = keys.some(k =>
        k.includes('objective') ||
        k.includes('วัตถุประสงค์') ||
        k.includes('purpose')
    );

    // ถ้ามี Unit_name + Outcome + tpqi → ไฟล์หน่วยการเรียน
    if (hasUnitKeys && hasOutcomeKeys && hasTpqiKeys) {
        return 'unit';
    }
    if (hasUnitKeys && hasObjectiveKeys) {
        return 'unit';
    }

    // 🔹 ตรวจสอบประเภทไฟล์เนื้อหา
    const hasContentKeys = keys.some(k =>
        k.includes('content') ||
        k.includes('เนื้อหา') ||
        k.includes('สาระ')
    );

    const hasReferenceKeys = keys.some(k =>
        k.includes('reference') ||
        k.includes('referrence') ||
        k.includes('อ้างอิง') ||
        k.includes('reference') ||
        k.includes('การค้นคว้า')
    );

    // ถ้ามี content + reference → ไฟล์เนื้อหา
    if (hasContentKeys && (hasReferenceKeys || keys.length <= 5)) {
        return 'content';
    }
    if (hasContentKeys && hasUnitKeys && !hasOutcomeKeys) {
        return 'content';
    }

    // 🔹 ตรวจสอบประเภทไฟล์แบบฝึกหัด/ทดสอบ
    const hasTestKeys = keys.some(k =>
        k.includes('test') ||
        k.includes('แบบทดสอบ') ||
        k.includes('แบบฝึกหัด') ||
        k.includes('exam') ||
        k.includes('exercise') ||
        k.includes('คำถาม')
    );

    const hasAnswerKeys = keys.some(k =>
        k.includes('answer') ||
        k.includes('เฉลย') ||
        k.includes('solutions') ||
        k.includes('คำตอบ')
    );

    // ถ้ามี test + answers → ไฟล์แบบฝึกหัด
    if (hasTestKeys && hasAnswerKeys) {
        return 'test';
    }
    if (hasTestKeys && keys.length <= 5) {
        return 'test';
    }

    return 'unknown';
}

export async function analyzeUploadedFiles(uploadedFiles) {
    const fileAnalysis = {};
    let fileIndex = 0;

    for (const file of uploadedFiles) {
        const ext = path.extname(file.filename).toLowerCase();

        try {
            let dataBySheet = {};

            if (ext === ".csv") {
                // CSV = 1 sheet
                const rows = await readCSV(file.path);
                if (rows.length === 0) {
                    throw new Error(`ไฟล์ ${file.originalname} ไม่มีข้อมูล`);
                }
                dataBySheet[file.originalname] = rows;

            } else if (ext === ".xlsx" || ext === ".xls") {
                // Excel = หลาย sheet
                dataBySheet = readExcelAllSheets(file.path);
                if (Object.keys(dataBySheet).length === 0) {
                    throw new Error(`ไฟล์ ${file.originalname} ไม่มี Sheet ที่มีข้อมูล`);
                }
            }

            // 🔹 วิเคราะห์แต่ละ Sheet
            for (const [sheetName, rows] of Object.entries(dataBySheet)) {
                const firstRow = rows[0];
                const detectedType = detectFileType(firstRow);

                fileAnalysis[fileIndex] = {
                    fileName: file.originalname,
                    sheetName: sheetName,
                    path: file.path,
                    type: detectedType,
                    rowCount: rows.length,
                    columns: Object.keys(firstRow),
                    data: rows
                };

                logger.info(`🔍 File: ${file.originalname} | Sheet: "${sheetName}" | Type: ${detectedType} | Rows: ${rows.length}`);
                fileIndex++;
            }

        } catch (error) {
            logger.error(`❌ Error analyzing ${file.originalname}:`, error.message);
            throw new Error(`ไม่สามารถอ่านไฟล์ ${file.originalname}: ${error.message}`);
        }
    }

    return fileAnalysis;
}

export function readExcelAllSheets(filePath) {
    const workbook = xlsx.readFile(filePath);
    const allData = {};

    // 🔹 อ่าน Sheet ทั้งหมด
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        // Clean data
        const cleanedData = data.map(row => {
            const cleanRow = {};
            Object.keys(row).forEach(key => {
                const cleanKey = key.trim();
                cleanRow[cleanKey] = typeof row[key] === "string" ? row[key].trim() : row[key];
            });
            return cleanRow;
        });

        if (cleanedData.length > 0) {
            allData[sheetName] = cleanedData;
            logger.info(`📊 Sheet: "${sheetName}" → ${cleanedData.length} rows`);
        }
    }

    return allData;
}
