import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const config = {
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