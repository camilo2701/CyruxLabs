import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { postBugReport, getBugCounts } from '../controllers/bugReportController.js';

const router = Router();

router.post('/', requireAuth, postBugReport);

router.get('/counts', requireAuth, requireRole(1, 2), getBugCounts);

export default router;