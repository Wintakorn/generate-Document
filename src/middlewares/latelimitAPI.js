import rateLimit from "express-rate-limit";

export const apiLimiter = () => rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { success: false, message: "คำขอมากเกินไป กรุณารอสักครู่" },
    standardHeaders: true,
    legacyHeaders: false,
});