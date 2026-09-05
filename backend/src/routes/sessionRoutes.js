import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import {
    getMySessions,
    getSessionsByUserId,
    postStartSession,
    postStopSession,
} from '../controllers/sessionController.js';

const router = Router();

router.get('/me', requireAuth, getMySessions);
router.get('/user/:userid', requireAuth, requireRole(1, 2), getSessionsByUserId);

// Sin auth por ahora 
router.post('/start', postStartSession);
router.post('/stop', postStopSession);

export default router;