import mongoose from "mongoose";

export const healthCheck = async (req, res) => {
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
};
