import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { listLogs } from '../controllers/logController.js';

const router = Router();

router.get('/', requireAuth, requireRole(2), listLogs);

export default router;