import { Router } from 'express';
import { uploadLabZip } from '../middleware/upload.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import {
    createLab,
    checkTitleDuplicate,
    getAllLabs,
    getManagedLabs,
    getLabForEdit,
    updateLab,
    requestFileUpdate,
    cancelFileUpdate,
    forceApplyFileUpdate,
    deleteLab,
} from '../controllers/labsController.js';

const router = Router();

router.post('/', requireAuth, requireRole(1, 2), uploadLabZip, createLab);
router.get('/check-title', checkTitleDuplicate);
router.get('/', getAllLabs);
// Gestionar laboratorios: admin ve todos, instructor solo los suyos
router.get('/manage', requireAuth, requireRole(1, 2), getManagedLabs);
// Todo lo que la pantalla de edición necesita de un lab (instrucciones, trofeos, flag, actualización pendiente)
router.get('/:labid/manage', requireAuth, requireRole(1, 2), getLabForEdit);
router.put('/:labid', requireAuth, requireRole(1, 2), updateLab);
// Nuevo zip + flag: se programan y se aplican cuando el lab no tiene sesiones abiertas
router.post('/:labid/update-request', requireAuth, requireRole(1, 2), uploadLabZip, requestFileUpdate);
router.delete('/:labid/update-request', requireAuth, requireRole(1, 2), cancelFileUpdate);
// Solo admin: aplica ya la actualización pendiente cerrando las sesiones abiertas
router.post('/:labid/update-request/apply-now', requireAuth, requireRole(2), forceApplyFileUpdate);
router.delete('/:labid', requireAuth, requireRole(1, 2), deleteLab);

export default router;
