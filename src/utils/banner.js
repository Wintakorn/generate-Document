import mongoose from "mongoose";
import { config } from "../config/configs.js";
import logger from "./logger.js";

export const banner = `
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