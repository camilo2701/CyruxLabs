import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { postBugReport } from '../controllers/bugReportController.js';

const router = Router();

router.post('/', requireAuth, postBugReport);

export default router;