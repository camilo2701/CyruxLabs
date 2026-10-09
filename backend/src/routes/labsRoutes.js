import { Router } from 'express';
import { uploadLabZip } from '../middleware/upload.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import {
    createLab,
    checkTitleDuplicate,
    getAllLabs,
    updateLab,
    deleteLab,
} from '../controllers/labsController.js';

const router = Router();

router.post('/', requireAuth, requireRole(1, 2), uploadLabZip, createLab);
router.get('/check-title', checkTitleDuplicate);
router.get('/', getAllLabs);
router.put('/:labid', requireAuth, requireRole(1, 2), updateLab);
router.delete('/:labid', requireAuth, requireRole(1, 2), deleteLab);

export default router;