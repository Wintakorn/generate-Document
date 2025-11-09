import express from "express";
import { generateDocuments } from "../controllers/generate-document.js";
import { upload } from "../middlewares/multer.js";
const router = express.Router();


router.post('/generate-documents', upload.array("files"), generateDocuments);

export default router;