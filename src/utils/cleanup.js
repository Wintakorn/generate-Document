import path from "path";
import { config } from "../config/configs.js";
import logger from "./logger.js";
import fs from "fs-extra";

export const cleanupOldFiles = async () => {
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