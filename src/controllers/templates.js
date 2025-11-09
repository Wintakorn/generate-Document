import path from "path";
import logger from "../utils/logger.js";
import { config } from "../config/configs.js";
import fs from "fs-extra";
export const fetchTemplates = async (req, res) => {
    try {
        const templates = [
            { id: 'course', name: 'หลักสูตรรายวิชา', icon: '📚', description: 'สำหรับสร้างเอกสารหลักสูตรรายวิชา' },
            { id: 'Unit_name', name: 'หน่วยการเรียนรู้', icon: '📚', description: 'สำหรับสร้างเอกสารหน่วยการเรียนรู้' },
            { id: 'Behavioral_analysis_table', name: 'ตารางวิเคราะห์พฤติกรรมการเรียนรู้', icon: '📊', description: 'สำหรับสร้างตารางวิเคราะห์พฤติกรรมการเรียนรู้' },
            { id: 'Vocational_standard', name: 'มาตรฐานวิชาชีพ', icon: '🏆', description: 'สำหรับสร้างหนังสือมาตรฐานวิชาชีพ' },
            { id: 'Learning_management_plan', name: 'แผนการจัดการเรียนรู้', icon: '📊', description: 'สำหรับสร้างแผนการจัดการเรียนรู้' },
            { id: 'Knowledge_sheet', name: 'ใบความรู้', icon: '📊', description: 'สำหรับสร้างใบความรู้' },
            { id: 'Work_Assignment', name: 'ใบมอบหมายงาน', icon: '📊', description: 'สำหรับสร้างใบมอบหมายงาน' },
            { id: 'work_sheet', name: 'ใบงาน', icon: '📊', description: 'สำหรับสร้างใบงาน' },
            { id: 'Activity_documents', name: 'ใบกิจกรรม', icon: '📊', description: 'สำหรับสร้างใบกิจกรรม' }
        ];

        const availableTemplates = [];
        for (const tmpl of templates) {
            const templatePath = path.join(config.templateDir, `${tmpl.id}_template.ejs`);
            if (await fs.pathExists(templatePath)) {
                availableTemplates.push(tmpl);
            }
        }

        res.json({
            success: true,
            templates: availableTemplates,
            count: availableTemplates.length
        });
    } catch (error) {
        logger.error('Error fetching templates:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล template'
        });
    }
};
