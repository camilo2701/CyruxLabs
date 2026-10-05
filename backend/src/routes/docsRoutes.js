import { Router } from 'express';
import { getCreationGuideMarkdown } from '../controllers/docsController.js';

const router = Router();

router.get('/creation-guide', getCreationGuideMarkdown);

export default router;