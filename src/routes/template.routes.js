import express from "express"; 
import { fetchTemplates } from '../controllers/templates.js'

const router = express.Router();

router.get('/templates', fetchTemplates);

export default router;