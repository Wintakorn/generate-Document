import mongoose from "mongoose";


const dataSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    template: { type: String, required: true },
    fileCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: 86400 }
}, { timestamps: true });

export const DataModel = mongoose.model("Document", dataSchema);
