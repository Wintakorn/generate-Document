import { findValue } from "./file_management.js";

export default function mapDataForTemplate(data, templateType) {
    switch (templateType) {
        case 'course':
            return {
                หลักสูตร: findValue(data, ['หลักสูตร']),
                ประเภทวิชา: findValue(data, ['ประเภทวิชา']),
                รหัสวิชา: findValue(data, ['course_code']),
                ชื่อวิชา: findValue(data, ['ชื่อวิชา ไทย', 'subject_name_th', 'ชื่อวิชา']),
                ชื่อวิชาอังกฤษ: findValue(data, ['subject_name_en', 'ชื่อวิชา อังกฤษ']),
                ทฤษฎี: findValue(data, ['ทฤษฎี']),
                ปฏิบัติ: findValue(data, ['ปฏิบัติ']),
                หน่วยกิต: findValue(data, ['หน่วยกิต']),
                อ้างอิงมาตรฐาน: findValue(data, ['refer']),
                ผลลัพธ์รายวิชา: findValue(data, ['outcom', 'ผลลัพธ์การเรียนรู้ระดับรายวิชา', 'ผลลัพธ์รายวิชา']),
                จุดประสงค์รายวิชา: findValue(data, ['objective']),
                สมรรถนะรายวิชา: findValue(data, ['competency']),
                คำอธิบายรายวิชา: findValue(data, ['course_description']),
                เครื่องมือ: findValue(data, ['เครื่องมือ/สิ่งนำมาสอน', 'เครื่องมือ'])
            };

        case 'Unit_name':
        case 'Behavioral_analysis_table':
            const unitName = findValue(data, ['Unit_name', 'ชื่อหน่วยการเรียนรู้', 'ชื่อหน่วย']);
            let unitTitle = unitName;

            if (unitName) {
                const match = unitName.match(/หน่วยที่\s*\d+\s*[:：]\s*(.+)/);
                if (match) {
                    unitTitle = match[1].trim();
                }
            }

            return {
                ชื่อหน่วยการเรียนรู้: unitTitle || ''
            };

        case 'Vocational_standard':
            return {
                มาตรฐานอาชีพ: findValue(data, ['มาตรฐานอาชีพ']),
                หน้าที่หลัก: findValue(data, ['หน้าที่หลัก (Key Function)', 'หน้าที่หลัก']),
                หน่วยสมรรถนะ: findValue(data, ['หน่วยสมรรถนะ (Unit of Competence)', 'หน่วยสมรรถนะ']),
                สมรรถนะย่อย: findValue(data, ['สมรรถนะย่อย (Element)', 'สมรรถนะย่อย']),
                เกณฑ์การปฏิบัติงาน: findValue(data, ['เกณฑ์ในการปฏิบัติงาน (Performance Criteria)', 'เกณฑ์การปฏิบัติงาน', 'เกณฑ์ในการปฏิบัติงาน']),
                วิธีการประเมิน: findValue(data, ['วิธีการประเมิน (Assessment)', 'วิธีการประเมิน'])
            };

        case 'Learning_management_plan':
            return {
                Unit_name: findValue(data, ['Unit_name', 'ชื่อหน่วยการเรียนรู้', 'ชื่อหน่วย']),
                Outcom: findValue(data, ['Outcom', 'Outcom', 'ผลลัพธ์การเรียนรู้']),
                tpqi: findValue(data, ['tpqi', 'ตัวบ่งชี้']),
                objective: findValue(data, ['objective', 'วัตถุประสงค์']),
                Learning_content: findValue(data, ['Learning_content', 'เนื้อหาการเรียนรู้']),
                Learning_activities: findValue(data, ['Learning_activities', 'กิจกรรมการเรียนรู้']),
                learning_resources: findValue(data, ['learning_resources', 'แหล่งการเรียนรู้']),
                Evidence_learning: findValue(data, ['Evidence_learning', 'หลักฐานการเรียนรู้']),
                Evaluation: findValue(data, ['Evaluation', 'การประเมินผล'])
            };

        case 'Knowledge_sheet':
            return {
                Unit_name: findValue(data, ['Unit_name', 'ชื่อหน่วยการเรียนรู้', 'ชื่อหน่วย']),
                Outcom: findValue(data, ['Outcom', 'ผลลัพธ์การเรียนรู้']),
                tpqi: findValue(data, ['tpqi', 'ตัวบ่งชี้']),
                objective: findValue(data, ['objective', 'วัตถุประสงค์']),
                content: findValue(data, ['content', 'เนื้อหา']),
                test: findValue(data, ['test', 'แบบทดสอบ']),
                references: findValue(data, ['references', 'แหล่งอ้างอิง']),
                answers: findValue(data, ['answers', 'เฉลย'])
            };

        case 'work_sheet':
            return {
                ใบงานที่: findValue(data, ['ใบงานที่']),
                ผลลัพธ์การเรียนรู้จากการปฏิบัติงาน: findValue(data, ['ผลลัพธ์การเรียนรู้จากการปฏิบัติงาน']),
                สมรรถนะการปฏิบัติงาน: findValue(data, ['สมรรถนะการปฏิบัติงาน']),
                จุดประสงค์เชิงพฤติกรรม: findValue(data, ['จุดประสงค์เชิงพฤติกรรม']),
                เครื่องมือวัสดุและอุปกรณ์: findValue(data, ['เครื่องมือ วัสดุ และอุปกรณ์']),
                คำแนะนำข้อควรระวัง: findValue(data, ['คำแนะนำ/ข้อควรระวัง']),
                ขั้นตอนการปฏิบัติงาน: findValue(data, ['ขั้นตอนการปฏิบัติงาน']),
                สรุปและวิจารณ์ผล: findValue(data, ['สรุปและวิจารณ์ผล']),
                การประเมินผล: findValue(data, ['การประเมินผล']),
                เอกสารอ้างอิงเอกสารค้นคว้าเพิ่มเติม: findValue(data, ['เอกสารอ้างอิง / เอกสารค้นคว้าเพิ่มเติม'])
            };

        case 'Work_Assignment':
            return {
                ใบมอบหมายงานที่: findValue(data, ['ใบมอบหมายงานที่']),
                ผลงานหรือผลการปฏิบัติงาน: findValue(data, ['ผลงานหรือผลการปฏิบัติงาน']),
                สมรรถนะการปฏิบัติงาน: findValue(data, ['สมรรถนะการปฏิบัติงาน']),
                จุดประสงค์เชิงพฤติกรรม: findValue(data, ['จุดประสงค์เชิงพฤติกรรม']),
                รายละเอียดของงาน: findValue(data, ['รายละเอียดของงาน']),
                กำหนดเวลาส่งงาน: findValue(data, ['กำหนดเวลาส่งงาน']),
                แนวทางในการปฏิบัติงาน: findValue(data, ['แนวทางในการปฏิบัติงาน']),
                แหล่งข้อมูลค้นคว้าเพิ่มเติม: findValue(data, ['แหล่งข้อมูลค้นคว้าเพิ่มเติม']),
                การประเมินผล: findValue(data, ['การประเมินผล'])
            };

        case 'Activity_documents':
            return {
                ใบกิจกรรมที่: findValue(data, ['ใบกิจกรรมที่']),
                ผลลัพธ์การเรียนรู้การปฏิบัติกิจกรรม: findValue(data, ['ผลลัพธ์การเรียนรู้การปฏิบัติกิจกรรม']),
                สมรรถนะประจำกิจกรรม: findValue(data, ['สมรรถนะประจำกิจกรรม']),
                จุดประสงค์เชิงพฤติกรรม: findValue(data, ['จุดประสงค์เชิงพฤติกรรม']),
                เครื่องมือ_วัสดุ_และอุปกรณ์: findValue(data, ['เครื่องมือ วัสดุ และอุปกรณ์']),
                ขั้นตอนการปฏิบัติกิจกรรม: findValue(data, ['ขั้นตอนการปฏิบัติกิจกรรม']),
                สรุปและอภิปรายผล: findValue(data, ['สรุปและอภิปรายผล']),
                การประเมินผล: findValue(data, ['การประเมินผล']),
                เอกสารอ้างอิง_เอกสารค้นคว้าเพิ่มเติม: findValue(data, ['เอกสารอ้างอิง / เอกสารค้นคว้าเพิ่มเติม'])
            }

        default:
            return data;
    }
}