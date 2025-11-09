import express from "express";
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import { apiLimiter } from "./src/middlewares/latelimitAPI.js"
import multer from "multer";
import path from "path";
import fs from "fs-extra";
import { config } from './src/config/configs.js'
import { connectDB } from './src/database/connectDB.js'
// import healthRoutes from "./src/routes/health.routes.js";
import templateRoutes from "./src/routes/template.routes.js"
import generateRoutes from './src/routes/generate.routes.js'
import { cleanupOldFiles } from "./src/utils/cleanup.js";

const app = express();

// ====== Security Middleware ======
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));


 
import { fileURLToPath } from "url";
import logger from "./src/utils/logger.js";
import { banner } from "./src/utils/banner.js";



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// ====== Connect to MongoDB ======
connectDB();
// ====== Auto Cleanup ======
cleanupOldFiles();
// ====== API Routes ======
//Root endpoint
app.get("/", (req, res) => {
    const frontendPath = path.join(__dirname, "public", "index.html");
    if (fs.existsSync(frontendPath)) {
        res.sendFile(frontendPath);
    } else {
        res.send('หน้าเว็บไม่พร้อมใช้งาน ขณะนี้กำลังพัฒนาเว็บไซต์');
    }
});
app.use("/api/", apiLimiter());
app.use("/api", generateRoutes)
app.use("/api", templateRoutes)
// app.use("/api", healthRoutes)
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
const server = app.listen(config.port, () => {
    banner
});
server.on('error', (error) => {
    logger.error('Server error:', error);
    process.exit(1);
});
export default app;

