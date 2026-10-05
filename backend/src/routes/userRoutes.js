import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { putProfile, putAvatar, putPassword, deleteMe, getStudents, getProfile, getUserSearch,
    getManagedUsers, putManagedUser, deleteManagedUser } from '../controllers/userController.js';

const router = Router();

router.put('/me', requireAuth, putProfile);
router.put('/me/avatar', requireAuth, putAvatar);
router.put('/me/password', requireAuth, putPassword);
router.delete('/me', requireAuth, deleteMe);
router.get('/students', requireAuth, requireRole(1, 2), getStudents);

router.get('/search', requireAuth, getUserSearch);
router.get('/profile/:username', requireAuth, getProfile);

router.get('/manage', requireAuth, requireRole(1, 2), getManagedUsers);
router.put('/manage/:userid', requireAuth, requireRole(1, 2), putManagedUser);
router.delete('/manage/:userid', requireAuth, requireRole(1, 2), deleteManagedUser);

export default router;