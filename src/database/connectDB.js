import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { config } from "../config/configs.js";

export const connectDB = async () => {
    try {
        await mongoose.connect(config.mongoUri, {
            serverSelectionTimeoutMS: 5000,
        });
        logger.info('✅ MongoDB connected successfully');
        if (process.send) {
            process.send('ready');
        }
    } catch (error) {
        logger.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};