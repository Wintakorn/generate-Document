
import mapDataForTemplate from "./Mapdata.js";
import htmlDocx from "html-docx-js";
import ejs from "ejs"
import path from "path";
import { config } from "../config/configs.js";
import fs from "fs-extra";
import logger from "./logger.js";
import { findValue } from "./file_management.js";

// ============================================
// ✅ ฟังก์ชันกรองข้อมูลตามประเภท template
// ============================================

/**
 * กรองข้อมูลให้เหลือเพียงแถวที่เป็นประเภทที่ template ต้องการ
 * @param {Array} dataRows - ข้อมูลทั้งหมด
 * @param {String} templateType - ประเภท template
 * @returns {Array} - ข้อมูลที่ถูกกรอง
 */
function filterDataByTemplate(dataRows, templateType) {
    if (!dataRows || dataRows.length === 0) {
        return [];
    }

    // 🔹 กรองตามประเภท template
    switch (templateType) {
        case 'Knowledge_sheet':
        case 'Learning_management_plan':
            // ❌ ต้องการเฉพาะ 'unit' type
            return dataRows.filter(row => row._fileType === 'unit');

        case 'work_sheet':
        case 'Work_Assignment':
        case 'Activity_documents':
            // ❌ ต้องการทั้งหมด (ไม่กรอง)
            return dataRows;

        case 'Unit_name':
        case 'Behavioral_analysis_table':
            // ❌ ต้องการเฉพาะ 'unit' type
            return dataRows.filter(row => row._fileType === 'unit');

        case 'Vocational_standard':
            // ❌ ต้องการทั้งหมด (ไม่กรอง)
            return dataRows;

        case 'course':
        default:
            // ❌ ต้องการทั้งหมด (ไม่กรอง)
            return dataRows;
    }
}

export async function generate_Documents(dataRows, templateType, sessionId, fileMetadata = {}) {
    const templatePath = path.join(config.templateDir, `${templateType}_template.ejs`);

    if (!await fs.pathExists(templatePath)) {
        throw new Error(`ไม่พบ template: ${templateType}_template.ejs`);
    }

    const templateStr = await fs.readFile(templatePath, "utf8");
    const generatedFiles = [];

    // ✅ กรองข้อมูลตามประเภท template ก่อน
    const filteredDataRows = filterDataByTemplate(dataRows, templateType);

    if (filteredDataRows.length === 0) {
        throw new Error(`ไม่พบข้อมูลที่เหมาะสมสำหรับ template ${templateType}`);
    }

    logger.info(`📊 [${sessionId}] Filtered data: ${filteredDataRows.length} rows (from ${dataRows.length} total)`);

    // 🔥 ตรวจสอบว่าเป็น template ที่สร้างเอกสารเดียว
    const isUnitBasedTemplate =
        templateType === 'Unit_name' ||
        templateType === 'Behavioral_analysis_table' ||
        templateType === 'Vocational_standard' ||
        templateType === 'Learning_management_plan' ||
        templateType === 'Knowledge_sheet' ||
        templateType === 'Work_Assignment' ||
        templateType === 'work_sheet' ||
        templateType === 'Activity_documents';

    if (isUnitBasedTemplate) {
        if (templateType === 'Learning_management_plan') {
            logger.info(`📚 [${sessionId}] Creating multiple Learning_management_plan documents`);

            for (let i = 0; i < filteredDataRows.length; i++) {
                const row = filteredDataRows[i];
                const mapped = mapDataForTemplate(row, templateType);

                const templateData = {
                    unitName: mapped.Unit_name || '',
                    outcom: mapped.Outcom || '',
                    tpqi: mapped.tpqi || '',
                    objective: mapped.objective || '',
                    content: mapped.Learning_content || '',
                    activities: mapped.Learning_activities || '',
                    resources: mapped.learning_resources || '',
                    evidence: mapped.Evidence_learning || '',
                    evaluation: mapped.Evaluation || '',
                    competency: mapped.tpqi || '',
                    performanceCriteria: mapped.performanceCriteria || '',
                    assessmentMethod: mapped.assessmentMethod || '',
                    performanceEvidence: mapped.performanceEvidence || '',
                    knowledgeEvidence: mapped.knowledgeEvidence || '',
                    vocationalIntegration: mapped.vocationalIntegration || '',
                    assessmentCriteria: mapped.assessmentCriteria || '',
                    assessmentTools: mapped.assessmentTools || ''
                };

                try {
                    const html = ejs.render(templateStr, templateData);
                    const blob = htmlDocx.asBlob(html);
                    const arrayBuffer = await blob.arrayBuffer();
                    const docxBuffer = Buffer.from(arrayBuffer);

                    const safeUnitName = (templateData.unitName || `Unit_${i + 1}`)
                        .replace(/[\\/:*?"<>|]/g, "_")
                        .substring(0, 50);

                    const fileName = `Learning_management_plan_${safeUnitName}_${sessionId.substring(0, 8)}.docx`;
                    const filePath = path.join(config.outputDir, fileName);

                    await fs.writeFile(filePath, docxBuffer);
                    generatedFiles.push({
                        name: fileName,
                        path: filePath,
                        url: `/output/${fileName}`
                    });

                    logger.info(`✅ [${sessionId}] Generated Learning_management_plan: ${fileName}`);
                } catch (error) {
                    logger.error(`❌ Error generating Learning_management_plan for unit ${i + 1}:`, error);
                    throw new Error(`ไม่สามารถสร้างเอกสารแผนการจัดการเรียนรู้หน่วยที่ ${i + 1}: ${error.message}`);
                }
            }
        } else if (templateType === 'Knowledge_sheet') {
            logger.info(`📚 [${sessionId}] Processing Knowledge_sheet`);

            let unitData = [];
            let contentData = [];
            let testData = [];

            // 🔹 จำแนกข้อมูลตามประเภทไฟล์ (จากข้อมูลทั้งหมด ไม่เฉพาะ filteredDataRows)
            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                const fileType = row._fileType || 'unknown';
                const mapped = mapDataForTemplate(row, templateType);

                if (fileType === 'unit') {
                    unitData.push({
                        rowIndex: i,
                        Unit_name: mapped.Unit_name || '',
                        Outcom: mapped.Outcom || '',
                        tpqi: mapped.tpqi || '',
                        objective: mapped.objective || ''
                    });
                    logger.info(`📖 [${sessionId}] Unit ${unitData.length}: ${mapped.Unit_name}`);
                }
                else if (fileType === 'content') {
                    contentData.push({
                        rowIndex: i,
                        Unit_name: mapped.Unit_name || `หน่วยที่ ${contentData.length + 1}`,
                        content: mapped.content || '',
                        references: mapped.references || ''
                    });
                }
                else if (fileType === 'test') {
                    testData.push({
                        rowIndex: i,
                        Unit_name: mapped.Unit_name || `หน่วยที่ ${testData.length + 1}`,
                        test: mapped.test || '',
                        answers: mapped.answers || ''
                    });
                }
            }

            logger.info(`📊 [${sessionId}] Detected: ${unitData.length} units, ${contentData.length} content, ${testData.length} tests`);

            if (unitData.length === 0) {
                throw new Error('ไม่พบข้อมูลหน่วยการเรียน - ตรวจสอบว่า Column มี Unit_name, Outcome, tpqi');
            }

            // 🔹 สร้างไฟล์สำหรับแต่ละหน่วย
            for (let unitIndex = 0; unitIndex < unitData.length; unitIndex++) {
                const unit = unitData[unitIndex];

                const relatedContent = contentData[unitIndex] || { content: '', references: '' };
                const relatedTest = testData[unitIndex] || { test: '', answers: '' };

                const templateData = {
                    Unit_name: unit.Unit_name,
                    Outcom: unit.Outcom,
                    tpqi: unit.tpqi,
                    objective: unit.objective,
                    content: relatedContent.content,
                    references: relatedContent.references,
                    test: relatedTest.test,
                    answers: relatedTest.answers,
                    unitNumber: unitIndex + 1,
                    totalUnits: unitData.length
                };

                try {
                    const html = ejs.render(templateStr, templateData);
                    const blob = htmlDocx.asBlob(html);
                    const arrayBuffer = await blob.arrayBuffer();
                    const docxBuffer = Buffer.from(arrayBuffer);

                    const safeName = (unit.Unit_name || `Unit_${unitIndex + 1}`)
                        .replace(/[\\/:*?"<>|]/g, "_")
                        .substring(0, 100);

                    const fileName = `Knowledge_sheet_${safeName}_${sessionId.substring(0, 8)}.docx`;
                    const filePath = path.join(config.outputDir, fileName);

                    await fs.writeFile(filePath, docxBuffer);
                    generatedFiles.push({
                        name: fileName,
                        path: filePath,
                        url: `/output/${fileName}`
                    });

                    logger.info(`✅ [${sessionId}] Generated: ${fileName}`);
                } catch (error) {
                    logger.error(`❌ Error: ${error.message}`);
                    throw error;
                }
            }
        } else if (templateType === 'Vocational_standard') {
            logger.info(`📚 [${sessionId}] Creating Vocational_standard document`);

            const standards = [];
            let vocationalInfo = {
                field: '',
                occupation: '',
                standardName: ''
            };

            // ✅ ดึงข้อมูลจากแถวแรกเท่านั้น
            if (filteredDataRows.length > 0) {
                const firstRow = filteredDataRows[0];
                const mapped = mapDataForTemplate(firstRow, templateType);

                const standardName = mapped.มาตรฐานอาชีพ || findValue(firstRow, ['มาตรฐานอาชีพ']);
                vocationalInfo.standardName = standardName;

                if (standardName) {
                    const lines = standardName.split('\n');
                    if (lines.length > 0) {
                        vocationalInfo.field = lines[0].trim();
                    }
                    if (lines.length > 2) {
                        vocationalInfo.occupation = lines[2].trim();
                    }
                }
            }

            // ✅ ประมวลผลข้อมูล standards สำหรับแสดงในตาราง
            logger.info(`📊 [${sessionId}] Processing ${filteredDataRows.length} rows for Vocational_standard`);

            filteredDataRows.forEach((row, rowIndex) => {
                const mapped = mapDataForTemplate(row, templateType);

                const unitCode = mapped.หน่วยสมรรถนะ || findValue(row, ['หน่วยสมรรถนะ (Unit of Competence)', 'หน่วยสมรรถนะ']) || '';
                const elementCode = mapped.สมรรถนะย่อย || findValue(row, ['สมรรถนะย่อย (Element)', 'สมรรถนะย่อย']) || '';
                const criteria = mapped.เกณฑ์การปฏิบัติงาน || findValue(row, ['เกณฑ์ในการปฏิบัติงาน (Performance Criteria)', 'เกณฑ์การปฏิบัติงาน', 'เกณฑ์ในการปฏิบัติงาน']) || '';
                const assessment = mapped.วิธีการประเมิน || findValue(row, ['วิธีการประเมิน (Assessment)', 'วิธีการประเมิน']) || '';

                // ✅ ตรวจสอบว่ามีข้อมูลสำคัญ
                if (unitCode || elementCode || criteria) {
                    const parseCodeAndDesc = (text) => {
                        if (!text) return { code: '', description: '' };
                        const lines = text.split('\n').filter(l => l.trim());
                        return {
                            code: lines[0]?.trim() || '',
                            description: lines.slice(1).join(' ').trim() || ''
                        };
                    };

                    const unit = parseCodeAndDesc(unitCode);
                    const element = parseCodeAndDesc(elementCode);

                    standards.push({
                        rowNumber: rowIndex + 1,
                        unitCode: unit.code,
                        unitDescription: unit.description,
                        elementCode: element.code,
                        elementDescription: element.description,
                        performanceCriteria: criteria || '',
                        assessment: assessment || ''
                    });
                }
            });

            logger.info(`✅ [${sessionId}] Extracted ${standards.length} valid standards from ${filteredDataRows.length} rows`);

            if (standards.length === 0) {
                throw new Error('ไม่พบข้อมูลมาตรฐานที่ถูกต้อง - ตรวจสอบว่า Excel มี column: หน่วยสมรรถนะ, สมรรถนะย่อย, เกณฑ์การปฏิบัติงาน');
            }
            const templateData = {
                มาตรฐานอาชีพ: vocationalInfo.standardName || '',  // ← ใช้เฉพาะนี้
                standards: standards  // ← loop ในตาราง
            };

            logger.info(`📊 [${sessionId}] Vocational_standard data:`, {
                standardName: vocationalInfo.standardName,
                standardCount: standards.length
            });

            try {
                const html = ejs.render(templateStr, templateData);
                const blob = htmlDocx.asBlob(html);
                const arrayBuffer = await blob.arrayBuffer();
                const docxBuffer = Buffer.from(arrayBuffer);

                const fileName = `Vocational_Standard_${sessionId.substring(0, 8)}.docx`;
                const filePath = path.join(config.outputDir, fileName);

                await fs.writeFile(filePath, docxBuffer);
                generatedFiles.push({
                    name: fileName,
                    path: filePath,
                    url: `/output/${fileName}`
                });

                logger.info(`✅ [${sessionId}] Generated: ${fileName} with ${standards.length} standards`);
            } catch (error) {
                logger.error(`❌ Error generating Vocational_standard:`, error);
                logger.error(`📊 templateData:`, JSON.stringify(templateData, null, 2));
                throw new Error(`ไม่สามารถสร้างเอกสารมาตรฐานอาชีพ: ${error.message}`);
            }
        } else if (templateType === 'work_sheet') {
            logger.info(`📚 [${sessionId}] Creating work_sheet document`);

            for (let i = 0; i < filteredDataRows.length; i++) {
                const row = filteredDataRows[i];
                const mapped = mapDataForTemplate(row, templateType);

                const templateData = {
                    ใบงานที่: mapped.ใบงานที่ || '',
                    ผลลัพธ์การเรียนรู้จากการปฏิบัติงาน: mapped.ผลลัพธ์การเรียนรู้จากการปฏิบัติงาน || '',
                    สมรรถนะการปฏิบัติงาน: mapped.สมรรถนะการปฏิบัติงาน || '',
                    จุดประสงค์เชิงพฤติกรรม: mapped.จุดประสงค์เชิงพฤติกรรม || '',
                    เครื่องมือวัสดุและอุปกรณ์: mapped.เครื่องมือวัสดุและอุปกรณ์ || '',
                    คำแนะนำข้อควรระวัง: mapped.คำแนะนำข้อควรระวัง || '',
                    ขั้นตอนการปฏิบัติงาน: mapped.ขั้นตอนการปฏิบัติงาน || '',
                    สรุปและวิจารณ์ผล: mapped.สรุปและวิจารณ์ผล || '',
                    การประเมินผล: mapped.การประเมินผล || '',
                    เอกสารอ้างอิงเอกสารค้นคว้าเพิ่มเติม: mapped.เอกสารอ้างอิงเอกสารค้นคว้าเพิ่มเติม || ''
                };
                try {
                    const html = ejs.render(templateStr, templateData);
                    const blob = htmlDocx.asBlob(html);
                    const arrayBuffer = await blob.arrayBuffer();
                    const docxBuffer = Buffer.from(arrayBuffer);

                    const safeName = (templateData.ใบงานที่ || `work_sheet_${i + 1}`)
                        .replace(/[\\/:*?"<>|]/g, "_")
                        .substring(0, 100);

                    const fileName = `work_sheet_${safeName}_${sessionId.substring(0, 8)}.docx`;
                    const filePath = path.join(config.outputDir, fileName);
                    await fs.writeFile(filePath, docxBuffer);

                    generatedFiles.push({
                        name: fileName,
                        path: filePath,
                        url: `/output/${fileName}`
                    });
                    logger.info(`✅ [${sessionId}] Generated: ${fileName}`);
                } catch (error) {
                    logger.error(`❌ Error generating work_sheet for row ${i + 1}:`, error);
                    throw new Error(`ไม่สามารถสร้างเอกสารใบงานแถวที่ ${i + 1}: ${error.message}`);
                }
            }

        } else if (templateType === 'Work_Assignment') {
            logger.info(`📚 [${sessionId}] Creating Work_Assignment document`);

            for (let i = 0; i < filteredDataRows.length; i++) {
                const row = filteredDataRows[i];
                const mapped = mapDataForTemplate(row, templateType);

                const templateData = {
                    ใบมอบหมายงานที่: mapped.ใบมอบหมายงานที่ || '',
                    ผลงานหรือผลการปฏิบัติงาน: mapped.ผลงานหรือผลการปฏิบัติงาน || '',
                    สมรรถนะการปฏิบัติงาน: mapped.สมรรถนะการปฏิบัติงาน || '',
                    จุดประสงค์เชิงพฤติกรรม: mapped.จุดประสงค์เชิงพฤติกรรม || '',
                    รายละเอียดของงาน: mapped.รายละเอียดของงาน || '',
                    กำหนดเวลาส่งงาน: mapped.กำหนดเวลาส่งงาน || '',
                    แนวทางในการปฏิบัติงาน: mapped.แนวทางในการปฏิบัติงาน || '',
                    แหล่งข้อมูลค้นคว้าเพิ่มเติม: mapped.แหล่งข้อมูลค้นคว้าเพิ่มเติม || '',
                    การประเมินผล: mapped.การประเมินผล || ''
                }

                try {
                    const html = ejs.render(templateStr, templateData);
                    const blob = htmlDocx.asBlob(html);
                    const arrayBuffer = await blob.arrayBuffer();
                    const docxBuffer = Buffer.from(arrayBuffer);

                    const safeName = (templateData.ใบมอบหมายงานที่ || `Work_Assignment_${i + 1}`)
                        .replace(/[\\/:*?"<>|]/g, "_")
                        .substring(0, 100);
                    const fileName = `Work_Assignment_${safeName}_${sessionId.substring(0, 8)}.docx`;
                    const filePath = path.join(config.outputDir, fileName);
                    await fs.writeFile(filePath, docxBuffer);

                    generatedFiles.push({
                        name: fileName,
                        path: filePath,
                        url: `/output/${fileName}`
                    });
                    logger.info(`✅ [${sessionId}] Generated: ${fileName}`);
                } catch (error) {
                    logger.error(`❌ Error generating Work_Assignment document:`, error);
                    throw new Error(`ไม่สามารถสร้างเอกสาร Work_Assignment: ${error.message}`);
                }

            }

        } else if (templateType === 'Activity_documents') {
            logger.info(`📚 [${sessionId}] Creating Activity_documents document`);

            for (let i = 0; i < filteredDataRows.length; i++) {
                const row = filteredDataRows[i];
                const mapped = mapDataForTemplate(row, templateType);
                const templateData = {
                    ใบกิจกรรมที่: mapped.ใบกิจกรรมที่ || '',
                    ผลลัพธ์การเรียนรู้การปฏิบัติกิจกรรม: mapped.ผลลัพธ์การเรียนรู้การปฏิบัติกิจกรรม || '',
                    สมรรถนะประจำกิจกรรม: mapped.สมรรถนะประจำกิจกรรม || '',
                    จุดประสงค์เชิงพฤติกรรม: mapped.จุดประสงค์เชิงพฤติกรรม || '',
                    เครื่องมือ_วัสดุ_และอุปกรณ์: mapped.เครื่องมือ_วัสดุ_และอุปกรณ์ || '',
                    ขั้นตอนการปฏิบัติกิจกรรม: mapped.ขั้นตอนการปฏิบัติกิจกรรม || '',
                    สรุปและอภิปรายผล: mapped.สรุปและอภิปรายผล || '',
                    การประเมินผล: mapped.การประเมินผล || '',
                    เอกสารอ้างอิง_เอกสารค้นคว้าเพิ่มเติม: mapped.เอกสารอ้างอิง_เอกสารค้นคว้าเพิ่มเติม || ''
                }
                try {
                    const html = ejs.render(templateStr, templateData);
                    const blob = htmlDocx.asBlob(html);
                    const arrayBuffer = await blob.arrayBuffer();
                    const docxBuffer = Buffer.from(arrayBuffer);
                    const safeName = (templateData.ใบกิจกรรมที่ || `Activity_documents_${i + 1}`)
                        .replace(/[\\/:*?"<>|]/g, "_")
                        .substring(0, 100);
                    const fileName = `Activity_documents_${safeName}_${sessionId.substring(0, 8)}.docx`;
                    const filePath = path.join(config.outputDir, fileName);
                    await fs.writeFile(filePath, docxBuffer);
                    generatedFiles.push({
                        name: fileName,
                        path: filePath,
                        url: `/output/${fileName}`
                    });
                    logger.info(`✅ [${sessionId}] Generated: ${fileName}`);
                } catch (error) {
                    logger.error(`❌ Error generating Activity_documents document:`, error);
                    throw new Error(`ไม่สามารถสร้างเอกสาร Activity_documents: ${error.message}`);
                }
            }

        } else {
            logger.info(`📚 [${sessionId}] Creating ${templateType} document`);

            const units = filteredDataRows.map((row) => {
                const unitName = findValue(row, ['Unit_name', 'ชื่อหน่วยการเรียนรู้', 'ชื่อหน่วย', 'หน่วยการเรียนรู้']);
                let cleanName = unitName || '';

                const match = cleanName.match(/หน่วยที่\s*\d+\s*[:：]\s*(.+)/);
                if (match) {
                    cleanName = match[1].trim();
                }

                return {
                    name: cleanName,
                    theory: '',
                    practice: '',
                    knowledge: '',
                    understanding: '',
                    application: '',
                    analysis: '',
                    evaluation: '',
                    creation: '',
                    psychomotor: '',
                    affective: '',
                    practical: '',
                    total: '',
                    hours: ''
                };
            });

            const templateData = {
                courseCode: '',
                courseName: '',
                credits: '',
                theoryHours: '',
                practiceHours: '',
                units: units,
                totalTheory: '',
                totalPractice: '',
                grandTotal: '',
                totals: {
                    knowledge: '',
                    understanding: '',
                    application: '',
                    analysis: '',
                    evaluation: '',
                    creation: '',
                    psychomotor: '',
                    affective: '',
                    practical: '',
                    total: '',
                    hours: ''
                }
            };

            logger.info(`📊 [${sessionId}] Creating ${templateType} document with ${units.length} units`);

            try {
                const html = ejs.render(templateStr, templateData);
                const blob = htmlDocx.asBlob(html);
                const arrayBuffer = await blob.arrayBuffer();
                const docxBuffer = Buffer.from(arrayBuffer);

                const filePrefix = templateType === 'Unit_name'
                    ? 'Unit_Learning'
                    : 'Behavioral_Analysis';
                const fileName = `${filePrefix}_${sessionId.substring(0, 8)}.docx`;
                const filePath = path.join(config.outputDir, fileName);

                await fs.writeFile(filePath, docxBuffer);
                generatedFiles.push({
                    name: fileName,
                    path: filePath,
                    url: `/output/${fileName}`
                });

                logger.info(`✅ [${sessionId}] Generated: ${fileName} with ${units.length} units`);
            } catch (error) {
                logger.error(`❌ Error generating ${templateType} document:`, error);
                throw new Error(`ไม่สามารถสร้างเอกสาร ${templateType}: ${error.message}`);
            }
        }

    } else {
        // 🔥 สำหรับ template อื่นๆ (course, report, certificate) สร้างแยกแต่ละแถว
        logger.info(`📄 [${sessionId}] Generating ${filteredDataRows.length} individual documents for template: ${templateType}`);

        for (let i = 0; i < filteredDataRows.length; i++) {
            const row = filteredDataRows[i];
            const templateData = mapDataForTemplate(row, templateType);

            try {
                const html = ejs.render(templateStr, templateData);
                const blob = htmlDocx.asBlob(html);
                const arrayBuffer = await blob.arrayBuffer();
                const docxBuffer = Buffer.from(arrayBuffer);

                const safeName = (
                    templateData.ชื่อวิชา ||
                    templateData.รหัสวิชา ||
                    templateData.เลขที่ ||
                    templateData.ชื่อสกุล ||
                    `document_${i + 1}`
                )
                    .replace(/[\\/:*?"<>|]/g, "_")
                    .substring(0, 100);

                const fileName = `${safeName}_${sessionId.substring(0, 8)}.docx`;
                const filePath = path.join(config.outputDir, fileName);

                await fs.writeFile(filePath, docxBuffer);
                generatedFiles.push({
                    name: fileName,
                    path: filePath,
                    url: `/output/${fileName}`
                });

                logger.info(`✅ [${sessionId}] Generated: ${fileName}`);
            } catch (error) {
                logger.error(`❌ Error generating document ${i + 1}:`, error);
                throw new Error(`ไม่สามารถสร้างเอกสารแถวที่ ${i + 1}: ${error.message}`);
            }
        }
    }

    return generatedFiles;
}