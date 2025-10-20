require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs-extra");
const csv = require("csv-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const htmlDocx = require("html-docx-js");
const archiver = require("archiver");
const xlsx = require("xlsx");
const rateLimit = require("express-rate-limit");

// Import logger (create if not exists)
let logger;
try {
    logger = require("./config/logger");
} catch {
    logger = console; // Fallback to console
}

const app = express();

// ====== Configuration ======
const config = {
    port: parseInt(process.env.PORT) || 3001,
    mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/createDoc",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
    uploadDir: path.join(__dirname, process.env.UPLOAD_DIR || "uploads"),
    outputDir: path.join(__dirname, process.env.OUTPUT_DIR || "output"),
    templateDir: path.join(__dirname, process.env.TEMPLATE_DIR || "templates"),
    autoCleanup: process.env.AUTO_CLEANUP_ENABLED !== 'false',
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 24,
    fileMaxAge: parseInt(process.env.FILE_MAX_AGE_HOURS) || 48,
    nodeEnv: process.env.NODE_ENV || 'development'
};

// ====== Security Middleware ======
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
}));

app.use(compression());

app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { success: false, message: "คำขอมากเกินไป กรุณารอสักครู่" },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use("/api/", apiLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Morgan logging
if (logger.stream) {
    app.use(morgan('combined', { stream: logger.stream }));
}

// Static files
app.use("/output", express.static(config.outputDir));
app.use("/public", express.static(path.join(__dirname, "public")));

// Ensure directories exist
const ensureDirectories = async () => {
    const dirs = [config.uploadDir, config.outputDir, config.templateDir, 'logs'];
    for (const dir of dirs) {
        await fs.ensureDir(dir);
    }
};
ensureDirectories();

// ====== Request Logging Middleware ======
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (logger.logRequest) {
            logger.logRequest(req, res.statusCode, duration);
        }
    });
    next();
});

// ====== Multer Configuration ======
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: config.maxFileSize },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [".csv", ".xlsx", ".xls"];
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedMimes = [
            "text/csv",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ];

        if (allowedTypes.includes(ext) && allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("รองรับเฉพาะไฟล์ CSV หรือ Excel (.xlsx, .xls)"));
        }
    }
});

// ====== Mongoose Schema ======
const dataSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    template: { type: String, required: true },
    fileCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: 86400 }
}, { timestamps: true });

const DataModel = mongoose.model("Document", dataSchema);

// ====== MongoDB Connection ======
const connectDB = async () => {
    try {
        await mongoose.connect(config.mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
        });
        logger.info('✅ MongoDB connected successfully');

        // Send ready signal to PM2
        if (process.send) {
            process.send('ready');
        }
    } catch (error) {
        logger.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected. Attempting to reconnect...');
});

connectDB();

// ====== Auto Cleanup ======
const cleanupOldFiles = async () => {
    const maxAge = config.fileMaxAge * 60 * 60 * 1000;
    const now = Date.now();
    let totalDeleted = 0;

    for (const dir of [config.outputDir, config.uploadDir]) {
        try {
            const files = await fs.readdir(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stats = await fs.stat(filePath);
                if (now - stats.mtimeMs > maxAge) {
                    await fs.unlink(filePath);
                    totalDeleted++;
                    logger.info(`🗑️ Deleted old file: ${file}`);
                }
            }
        } catch (error) {
            logger.error(`Cleanup error in ${dir}:`, error);
        }
    }

    if (totalDeleted > 0) {
        logger.info(`🧹 Cleanup completed: ${totalDeleted} files deleted`);
    }
};

if (config.autoCleanup) {
    const interval = config.cleanupInterval * 60 * 60 * 1000;
    setInterval(cleanupOldFiles, interval);
    logger.info(`🧹 Auto-cleanup enabled (every ${config.cleanupInterval} hours)`);
}

// ====== Helper Functions ======
function readCSV(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath, { encoding: 'utf8' })
            .pipe(csv())
            .on("data", (row) => {
                const cleanRow = {};
                Object.keys(row).forEach(key => {
                    const cleanKey = key.trim();
                    cleanRow[cleanKey] = typeof row[key] === "string" ? row[key].trim() : row[key];
                });
                rows.push(cleanRow);
            })
            .on("end", () => resolve(rows))
            .on("error", reject);
    });
}

function readExcel(filePath) {
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

function findValue(data, possibleKeys) {
    for (const key of possibleKeys) {
        if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
            return data[key];
        }
    }
    return "";
}

function mapDataForTemplate(data, templateType) {
    switch (templateType) {
        case 'course':
            return {
                หลักสูตร: findValue(data, ['หลักสูตร']),
                ประเภทวิชา: findValue(data, ['ประเภทวิชา']),
                รหัสวิชา: findValue(data, ['รหัสวิชา']),
                ชื่อวิชา: findValue(data, ['ชื่อวิชา ไทย', 'ชื่อวิชาไทย', 'ชื่อวิชา']),
                ชื่อวิชาอังกฤษ: findValue(data, ['ชื่อวิชาอังกฤษ', 'ชื่อวิชา อังกฤษ']),
                ทฤษฎี: findValue(data, ['ทฤษฎี']),
                ปฏิบัติ: findValue(data, ['ปฏิบัติ']),
                หน่วยกิต: findValue(data, ['หน่วยกิต']),
                อ้างอิงมาตรฐาน: findValue(data, ['อ้างอิงมาตรฐาน']),
                ผลลัพธ์รายวิชา: findValue(data, ['ผลลัพธ์การเรียนรูระดับรายวิชา', 'ผลลัพธ์การเรียนรู้ระดับรายวิชา', 'ผลลัพธ์รายวิชา']),
                จุดประสงค์รายวิชา: findValue(data, ['จุดประสงค์รายวิชา']),
                สมรรถนะรายวิชา: findValue(data, ['สมรรถนะรายวิชา']),
                คำอธิบายรายวิชา: findValue(data, ['คำอธิบายรายวิชา']),
                เครื่องมือ: findValue(data, ['เครื่องมือ/สิ่งนำมาสอน', 'เครื่องมือ'])
            };

        case 'quotation':
            return {
                เลขที่: findValue(data, ['เลขที่', 'เลขที่เอกสาร']),
                วันที่: findValue(data, ['วันที่']),
                ลูกค้า: findValue(data, ['ลูกค้า', 'ชื่อลูกค้า']),
                ที่อยู่: findValue(data, ['ที่อยู่']),
                รายการ: findValue(data, ['รายการ', 'รายการสินค้า']),
                จำนวน: findValue(data, ['จำนวน']),
                ราคาต่อหน่วย: findValue(data, ['ราคาต่อหน่วย', 'ราคา']),
                ราคารวม: findValue(data, ['ราคารวม', 'รวม']),
                หมายเหตุ: findValue(data, ['หมายเหตุ'])
            };

        case 'report':
            return {
                รหัสนักเรียน: findValue(data, ['รหัสนักเรียน', 'รหัส']),
                ชื่อสกุล: findValue(data, ['ชื่อ-สกุล', 'ชื่อสกุล', 'ชื่อ']),
                วิชา: findValue(data, ['วิชา']),
                คะแนนสอบกลางภาค: findValue(data, ['คะแนนสอบกลางภาค', 'กลางภาค']),
                คะแนนสอบปลายภาค: findValue(data, ['คะแนนสอบปลายภาค', 'ปลายภาค']),
                คะแนนเก็บ: findValue(data, ['คะแนนเก็บ']),
                รวม: findValue(data, ['รวม', 'คะแนนรวม']),
                เกรด: findValue(data, ['เกรด']),
                สถานะ: findValue(data, ['สถานะ'])
            };

        case 'certificate':
            return {
                เลขที่: findValue(data, ['เลขที่']),
                ชื่อสกุล: findValue(data, ['ชื่อ-สกุล', 'ชื่อสกุล']),
                หลักสูตร: findValue(data, ['หลักสูตร']),
                วันที่สำเร็จการศึกษา: findValue(data, ['วันที่สำเร็จการศึกษา', 'วันที่']),
                เกรดเฉลี่ย: findValue(data, ['เกรดเฉลี่ย', 'GPA']),
                อันดับ: findValue(data, ['อันดับ']),
                หมายเหตุ: findValue(data, ['หมายเหตุ'])
            };

        default:
            return data;
    }
}

async function generateDocuments(dataRows, templateType, sessionId) {
    const templatePath = path.join(config.templateDir, `${templateType}_template.ejs`);

    if (!await fs.pathExists(templatePath)) {
        throw new Error(`ไม่พบ template: ${templateType}_template.ejs`);
    }

    const templateStr = await fs.readFile(templatePath, "utf8");
    const generatedFiles = [];

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
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
        } catch (error) {
            logger.error(`Error generating document ${i + 1}:`, error);
            throw new Error(`ไม่สามารถสร้างเอกสารแถวที่ ${i + 1}: ${error.message}`);
        }
    }

    return generatedFiles;
}

async function createZip(files, outputPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", () => resolve());
        output.on("error", reject);
        archive.on("error", reject);

        archive.pipe(output);

        for (const file of files) {
            if (fs.existsSync(file.path)) {
                archive.file(file.path, { name: file.name });
            }
        }

        archive.finalize();
    });
}

// ====== API Routes ======

// Root endpoint
app.get("/", (req, res) => {
    const frontendPath = path.join(__dirname, "public", "index.html");

    // ตรวจสอบว่ามีไฟล์ frontend หรือไม่
    if (fs.existsSync(frontendPath)) {
        res.sendFile(frontendPath);
    } else {
        // ถ้าไม่มีไฟล์ frontend ให้แสดงหน้า temporary
        res.send(`
            <!DOCTYPE html>
            <html lang="th">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Document Generator System</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    body { 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    }
                    .welcome-card {
                        border: none;
                        border-radius: 20px;
                        box-shadow: 0 15px 35px rgba(0,0,0,0.1);
                        background: white;
                    }
                    .api-endpoint {
                        background: #f8f9fa;
                        border-radius: 10px;
                        padding: 15px;
                        margin-bottom: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="row justify-content-center">
                        <div class="col-md-10 col-lg-8">
                            <div class="card welcome-card">
                                <div class="card-body p-5">
                                    <div class="text-center mb-4">
                                        <i class="fas fa-file-contract display-1 text-primary mb-3"></i>
                                        <h1 class="h2 fw-bold">Document Generator System</h1>
                                        <p class="text-muted">ระบบสร้างเอกสารอัตโนมัติ</p>
                                    </div>
                                    
                                    <div class="alert alert-success mb-4">
                                        <i class="fas fa-check-circle me-2"></i>
                                        <strong>ระบบพร้อมทำงาน!</strong> เซิร์ฟเวอร์เริ่มต้นสำเร็จ
                                    </div>
                                    
                                    <div class="row mb-4">
                                        <div class="col-md-6">
                                            <div class="card border-0 bg-light h-100">
                                                <div class="card-body text-center">
                                                    <i class="fas fa-heartbeat text-success mb-3 fa-2x"></i>
                                                    <h5>System Status</h5>
                                                    <p class="small text-muted">ตรวจสอบสถานะระบบ</p>
                                                    <a href="/api/health" class="btn btn-sm btn-outline-success">Health Check</a>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="card border-0 bg-light h-100">
                                                <div class="card-body text-center">
                                                    <i class="fas fa-list-alt text-primary mb-3 fa-2x"></i>
                                                    <h5>Templates</h5>
                                                    <p class="small text-muted">ดูเทมเพลตที่มี</p>
                                                    <a href="/api/templates" class="btn btn-sm btn-outline-primary">Template List</a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mb-4">
                                        <h5 class="mb-3">📋 วิธีใช้งาน API</h5>
                                        <div class="api-endpoint">
                                            <strong>POST /api/generate-documents</strong>
                                            <p class="mb-1 small text-muted">สร้างเอกสารจากไฟล์ข้อมูล</p>
                                            <code class="small">Content-Type: multipart/form-data</code>
                                        </div>
                                        <div class="api-endpoint">
                                            <strong>GET /api/templates</strong>
                                            <p class="mb-1 small text-muted">ดึงรายการเทมเพลตทั้งหมด</p>
                                        </div>
                                        <div class="api-endpoint">
                                            <strong>GET /api/health</strong>
                                            <p class="mb-1 small text-muted">ตรวจสอบสถานะระบบ</p>
                                        </div>
                                    </div>
                                    
                                    <div class="alert alert-info">
                                        <i class="fas fa-info-circle me-2"></i>
                                        <strong>Frontend กำลังพัฒนา</strong> - ระบบ API พร้อมใช้งานแล้ว
                                    </div>
                                    
                                    <div class="mt-4">
                                        <p class="text-muted small">
                                            <i class="fas fa-cog me-1"></i>
                                            <strong>Server:</strong> http://localhost:3001<br>
                                            <i class="fas fa-database me-1"></i>
                                            <strong>MongoDB:</strong> Connected<br>
                                            <i class="fas fa-code me-1"></i>
                                            <strong>Environment:</strong> development
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>
        `);
    }
});
// Health check
app.get("/api/health", async (req, res) => {
    const health = {
        status: "OK",
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: config.nodeEnv
    };

    const status = health.mongodb === "connected" ? 200 : 503;
    res.status(status).json(health);
});

// Get templates
app.get("/api/templates", async (req, res) => {
    try {
        const templates = [
            { id: 'course', name: 'หลักสูตรรายวิชา', icon: '📚', description: 'สำหรับสร้างเอกสารหลักสูตรรายวิชา' },
            { id: 'quotation', name: 'ใบเสนอราคา', icon: '💰', description: 'สำหรับสร้างใบเสนอราคา' },
            { id: 'report', name: 'รายงานผล', icon: '📊', description: 'สำหรับสร้างรายงานผล' },
            { id: 'certificate', name: 'หนังสือรับรอง', icon: '🏆', description: 'สำหรับสร้างหนังสือรับรอง' }
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
});

// Generate documents
app.post("/api/generate-documents", upload.single("file"), async (req, res) => {
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const startTime = Date.now();
    let uploadedFile = null;

    try {
        const { template = "course" } = req.body;
        uploadedFile = req.file;

        if (!uploadedFile) {
            return res.status(400).json({
                success: false,
                message: "กรุณาอัปโหลดไฟล์"
            });
        }

        logger.info(`📥 [${sessionId}] File received: ${uploadedFile.originalname}`);

        const ext = path.extname(uploadedFile.filename).toLowerCase();
        let dataRows;

        if (ext === ".csv") {
            dataRows = await readCSV(uploadedFile.path);
        } else {
            dataRows = readExcel(uploadedFile.path);
        }

        logger.info(`📊 [${sessionId}] Data rows: ${dataRows.length}`);

        if (dataRows.length === 0) {
            throw new Error("ไม่พบข้อมูลในไฟล์");
        }

        if (dataRows.length > 100) {
            throw new Error("ข้อมูลเกิน 100 แถว กรุณาแบ่งไฟล์");
        }

        // Save to MongoDB
        await DataModel.create({
            sessionId,
            data: dataRows,
            template,
            fileCount: dataRows.length
        });

        // Generate documents
        const files = await generateDocuments(dataRows, template, sessionId);

        // Create ZIP
        const zipFileName = `documents_${sessionId}.zip`;
        const zipPath = path.join(config.outputDir, zipFileName);
        await createZip(files, zipPath);

        // Cleanup
        await fs.remove(uploadedFile.path);

        const duration = Date.now() - startTime;

        if (logger.logGeneration) {
            logger.logGeneration(sessionId, template, files.length, duration, true);
        }

        res.json({
            success: true,
            message: "สร้างเอกสารสำเร็จ",
            sessionId,
            count: files.length,
            files,
            downloadUrl: `/output/${zipFileName}`,
            duration: `${duration}ms`
        });

    } catch (error) {
        const duration = Date.now() - startTime;

        if (logger.logGeneration) {
            logger.logGeneration(sessionId, req.body.template, 0, duration, false);
        }
        if (logger.logError) {
            logger.logError(error, req);
        }

        if (uploadedFile && await fs.pathExists(uploadedFile.path)) {
            await fs.remove(uploadedFile.path);
        }

        res.status(500).json({
            success: false,
            message: error.message || "เกิดข้อผิดพลาดในการสร้างเอกสาร",
            sessionId
        });
    }
});

// ====== Error Handling ======
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: `ไฟล์ใหญ่เกินไป (สูงสุด ${config.maxFileSize / 1024 / 1024}MB)`
            });
        }
    }

    if (logger.logError) {
        logger.logError(err, req);
    }

    res.status(500).json({
        success: false,
        message: err.message || "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์"
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "ไม่พบ Endpoint นี้"
    });
});

// ====== Graceful Shutdown ======
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} signal received: closing server gracefully`);

    try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ====== Start Server ======
const server = app.listen(config.port, () => {
    const banner = `
${'='.repeat(70)}
🚀 Document Generator Server
${'='.repeat(70)}
📍 Server URL      : http://localhost:${config.port}
🌐 Frontend URL    : ${config.frontendUrl}
💾 MongoDB         : ${mongoose.connection.readyState === 1 ? '✅ Connected' : '⏳ Connecting...'}
📁 Upload Dir      : ${config.uploadDir}
📄 Output Dir      : ${config.outputDir}
📋 Template Dir    : ${config.templateDir}
🔒 Max File Size   : ${config.maxFileSize / 1024 / 1024}MB
🧹 Auto Cleanup    : ${config.autoCleanup ? `✅ Every ${config.cleanupInterval}h` : '❌ Disabled'}
⏰ Environment     : ${config.nodeEnv}
${'='.repeat(70)}
`;
    logger.info(banner);
});

// Handle server errors
server.on('error', (error) => {
    logger.error('Server error:', error);
    process.exit(1);
});

module.exports = app;