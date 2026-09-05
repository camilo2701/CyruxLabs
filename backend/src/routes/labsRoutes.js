import { Router } from 'express';
import upload from '../middleware/upload.js';
import { createLab, checkTitleDuplicate, getAllLabs } from '../controllers/labsController.js';

const router = Router();

router.post('/', upload.single('zipfile'), createLab);
router.get('/check-title', checkTitleDuplicate);
router.get('/', getAllLabs);

export default router;