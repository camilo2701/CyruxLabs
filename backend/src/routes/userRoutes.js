import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { putProfile, putAvatar, putPassword } from '../controllers/userController.js';

const router = Router();

router.put('/me', requireAuth, putProfile);
router.put('/me/avatar', requireAuth, putAvatar);
router.put('/me/password', requireAuth, putPassword);

export default router;