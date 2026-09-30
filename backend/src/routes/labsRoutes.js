import { Router } from 'express';
import upload from '../middleware/upload.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import {
    createLab,
    checkTitleDuplicate,
    getAllLabs,
    updateLab,
    deleteLab,
} from '../controllers/labsController.js';

const router = Router();

router.post('/', requireAuth, requireRole(1, 2), upload.single('zipfile'), createLab);
router.get('/check-title', checkTitleDuplicate);
router.get('/', getAllLabs);
router.put('/:labid', requireAuth, requireRole(1, 2), updateLab);
router.delete('/:labid', requireAuth, requireRole(1, 2), deleteLab);

export default router;