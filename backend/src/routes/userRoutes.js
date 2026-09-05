import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { putProfile, putAvatar, putPassword, getStudents } from '../controllers/userController.js';

const router = Router();

router.put('/me', requireAuth, putProfile);
router.put('/me/avatar', requireAuth, putAvatar);
router.put('/me/password', requireAuth, putPassword);
router.get('/students', requireAuth, requireRole(1, 2), getStudents);

export default router;