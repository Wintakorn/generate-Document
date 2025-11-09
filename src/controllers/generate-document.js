import path from "path";
import { DataModel } from "../models/Document.js";
import { createZip } from "../utils/createZip.js";
import { analyzeUploadedFiles } from "../utils/file_management.js";
import logger from "../utils/logger.js";
import fs from "fs-extra";
import { generate_Documents } from "../utils/generateDocs.js";
import { config } from "../config/configs.js";
// ============================================
// ✅ เลือก Sheet ที่ถูกต้องตามประเภท Template
// ============================================

function compressDataForDB(dataRows) {
    return dataRows.map(row => {
        const compressed = {};

        // เก็บ metadata
        compressed._fileIndex = row._fileIndex;
        compressed._fileName = row._fileName;
        compressed._fileType = row._fileType;
        compressed._rowIndex = row._rowIndex;

        // เก็บเฉพาะ field ที่มีค่า
        Object.keys(row).forEach(key => {
            if (key.startsWith('_')) return;
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                compressed[key] = row[key];
            }
        });

        return compressed;
    });
}

function selectDataToSave(allDataRows, templateType) {
    if (!allDataRows || allDataRows.length === 0) {
        return [];
    }

    switch (templateType) {
        case 'Knowledge_sheet':
        case 'Learning_management_plan':
            return allDataRows.filter(row => row._fileType === 'unit');

        case 'Vocational_standard':
            // ✅ เฉพาะแถวแรก
            return allDataRows.slice(0, 1);

        case 'work_sheet':
        case 'Work_Assignment':
        case 'Activity_documents':
            return allDataRows;

        case 'Unit_name':
        case 'Behavioral_analysis_table':
            return allDataRows.filter(row => row._fileType === 'unit');

        case 'course':
        default:
            return allDataRows;
    }
}


/**
 * @param {String} templateType - The type of template
 * @returns {Array} Array of required sheet names
 */
function getRequiredSheets(templateType) {
    const sheetMap = {
        'course': ['หลักสูตรรายวิชา', 'course', 'รายวิชา'],
        'Knowledge_sheet': ['หน่วยการเรียน', 'เนื้อหา', 'แบบฝึกหัดแบบทดสอบ', 'unit', 'Unit_name'],
        'Learning_management_plan': ['หน่วยการเรียน', 'unit', 'Unit_name'],
        'Vocational_standard': ['มาตรฐานวิชาชีพ', 'vocational', 'standard', 'มาตรฐาน'],
        'work_sheet': ['ใบงาน', 'work_sheet', 'worksheet'],
        'Work_Assignment': ['ใบมอบหมายงาน', 'assignment', 'work_assignment'],
        'Unit_name': ['หน่วยการเรียน', 'unit', 'Unit_name'],
        'Behavioral_analysis_table': ['หน่วยการเรียน', 'unit', 'Unit_name'],
        'Activity_documents': ['ใบกิจกรรม', 'activity', 'activities']
    };
    return sheetMap[templateType] || [];
}

/**
 * ค้นหา Sheet ที่ตรงกัน (case-insensitive)
 * @param {Object} fileAnalysis - ข้อมูล analysis จากไฟล์
 * @param {String} templateType - ประเภท template
 * @returns {Array} - ข้อมูล sheet ที่ถูก
 */

function filterSheetsByTemplate(fileAnalysis, templateType) {
    const requiredSheets = getRequiredSheets(templateType);
    const filteredAnalysis = {};
    let found = false;

    Object.entries(fileAnalysis).forEach(([idx, info]) => {
        const sheetNameLower = (info.sheetName || '').toLowerCase();

        // ตรวจสอบว่า sheet name ตรงกับที่ต้องการไหม
        const isMatch = requiredSheets.some(requiredSheet =>
            sheetNameLower.includes(requiredSheet.toLowerCase())
        );

        if (isMatch) {
            filteredAnalysis[idx] = info;
            found = true;
            logger.info(`✅ [${templateType}] Found matching sheet: "${info.sheetName}"`);
        } else {
            logger.info(`⏭️ [${templateType}] Skipped sheet: "${info.sheetName}" (not matching)`);
        }
    });

    if (!found) {
        const requiredList = requiredSheets.join(', ');
        throw new Error(
            `ไม่พบ Sheet ที่ถูกต้องสำหรับ ${templateType}\n` +
            `ต้องการ Sheet: ${requiredList}\n` +
            `Sheet ที่เจอ: ${Object.values(fileAnalysis).map(f => f.sheetName).join(', ')}`
        );
    }

    return filteredAnalysis;
}

// ============================================
// ✅ แก้ไข Controller
// ============================================

export const generateDocuments = async (req, res) => {
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const startTime = Date.now();
    let uploadedFiles = [];

    try {
        const { template = "course" } = req.body;
        uploadedFiles = req.files;

        if (!uploadedFiles || uploadedFiles.length === 0) {
            return res.status(400).json({
                success: false,
                message: "กรุณาอัปโหลดไฟล์อย่างน้อย 1 ไฟล์"
            });
        }

        logger.info(`📥 [${sessionId}] Received ${uploadedFiles.length} files`);
        logger.info(`📋 [${sessionId}] Template type: ${template}`);

        // วิเคราะห์ไฟล์
        const fileAnalysis = await analyzeUploadedFiles(uploadedFiles);

        logger.info(`📋 [${sessionId}] Original files analysis:`);
        Object.entries(fileAnalysis).forEach(([idx, info]) => {
            logger.info(`  └─ ${info.fileName} | Sheet: "${info.sheetName}": ${info.type} (${info.rowCount} rows)`);
        });

        // ✅ กรอง Sheet ให้ตรงกับ template
        const filteredAnalysis = filterSheetsByTemplate(fileAnalysis, template);

        logger.info(`📋 [${sessionId}] Filtered files for ${template}:`);
        Object.entries(filteredAnalysis).forEach(([idx, info]) => {
            logger.info(`  └─ ${info.fileName} | Sheet: "${info.sheetName}": ${info.type} (${info.rowCount} rows)`);
        });

        // เก็บข้อมูลจาก Sheet ที่ถูกต้อง
        let allDataRows = [];
        const fileMetadata = {};

        Object.entries(filteredAnalysis).forEach(([idx, info]) => {
            fileMetadata[idx] = {
                fileName: info.fileName,
                sheetName: info.sheetName || '',
                type: info.type,
                rowCount: info.rowCount,
                columns: info.columns
            };

            const dataWithMeta = info.data.map((row, rowIdx) => ({
                ...row,
                _fileIndex: parseInt(idx),
                _fileName: info.fileName,
                _sheetName: info.sheetName,
                _fileType: info.type,
                _rowIndex: rowIdx
            }));

            allDataRows = allDataRows.concat(dataWithMeta);
        });

        logger.info(`📊 [${sessionId}] Total combined rows: ${allDataRows.length}`);

        if (allDataRows.length > 1000) {
            throw new Error("ข้อมูลรวมเกิน 1000 แถว");
        }

        // คัดเลือกข้อมูลตามประเภท template
        const dataToSave = selectDataToSave(allDataRows, template);
        logger.info(`💾 [${sessionId}] Saving ${dataToSave.length} rows to database (from ${allDataRows.length} total)`);

        // บีบอัดข้อมูล
        const compressedData = compressDataForDB(dataToSave);
        logger.info(`🗜️ [${sessionId}] Compressed data size: ${JSON.stringify(compressedData).length} bytes`);

        // บันทึก MongoDB
        await DataModel.create({
            sessionId,
            data: compressedData,
            template,
            fileCount: uploadedFiles.length,
            totalRows: allDataRows.length,
            savedRows: dataToSave.length
        });

        logger.info(`✅ [${sessionId}] Saved to database successfully`);

        // สร้างเอกสาร
        const files = await generate_Documents(allDataRows, template, sessionId, fileMetadata);

        // รวมเป็น ZIP
        const zipFileName = `documents_${sessionId}.zip`;
        const zipPath = path.join(config.outputDir, zipFileName);
        await createZip(files, zipPath);

        // ลบไฟล์ต้นฉบับ
        for (const file of uploadedFiles) {
            if (await fs.pathExists(file.path)) {
                await fs.remove(file.path);
            }
        }

        const duration = Date.now() - startTime;
        logger.info(`✅ [${sessionId}] Generated ${files.length} documents in ${duration}ms`);

        res.json({
            success: true,
            message: "สร้างเอกสารสำเร็จ",
            sessionId,
            count: files.length,
            files,
            fileAnalysis: Object.fromEntries(
                Object.entries(fileMetadata).map(([k, v]) => [
                    k,
                    {
                        fileName: v.fileName,
                        sheetName: v.sheetName,
                        type: v.type,
                        rowCount: v.rowCount
                    }
                ])
            ),
            databaseInfo: {
                totalRows: allDataRows.length,
                savedRows: dataToSave.length,
                templateType: template
            },
            downloadUrl: `/output/${zipFileName}`,
            duration: `${duration}ms`
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ [${sessionId}] Error: ${error.message}`);

        for (const file of uploadedFiles) {
            if (file && await fs.pathExists(file.path)) {
                await fs.remove(file.path);
            }
        }

        res.status(500).json({
            success: false,
            message: error.message || "เกิดข้อผิดพลาดในการสร้างเอกสาร",
            sessionId
        });
    }
};

