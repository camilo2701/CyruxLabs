import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import {
    getMySessions,
    getSessionsByUserId,
    getSessionDetails,
    postStartSession,
    postRestartSession,
    postStopSession,
    postSubmitFlag,
} from '../controllers/sessionController.js';

const router = Router();

router.get('/me', requireAuth, getMySessions);
router.get('/user/:userid', requireAuth, requireRole(1, 2), getSessionsByUserId);

router.get('/:sessionid', requireAuth, getSessionDetails);
router.post('/submit-flag', requireAuth, postSubmitFlag);

router.post('/start', requireAuth, postStartSession);
router.post('/stop', requireAuth, postStopSession);
router.post('/restart', requireAuth, postRestartSession);

export default router;