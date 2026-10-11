import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import {
    postBugReport,
    getBugCounts,
    getLabBugReports,
    patchBugReportStatus,
} from '../controllers/bugReportController.js';

const router = Router();

router.post('/', requireAuth, postBugReport);

router.get('/counts', requireAuth, requireRole(1, 2), getBugCounts);

// Revisión de reportes desde Gestionar laboratorios
router.get('/lab/:labid', requireAuth, requireRole(1, 2), getLabBugReports);
router.patch('/:bugreportid/status', requireAuth, requireRole(1, 2), patchBugReportStatus);

export default router;