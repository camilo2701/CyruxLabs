// Este archivo se encarga de definir las rutas para reportar y gestionar los reportes de bugs de los laboratorios.
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import {
    postBugReport,
    getBugCounts,
    getLabBugReports,
    patchBugReportStatus,
} from '../controllers/bugReportController.js';

const router = Router();

// Registro de ruta: cualquier usuario autenticado puede enviar un reporte de bug.
router.post('/', requireAuth, postBugReport);

// Registro de ruta: conteo de reportes. Solo instructor (1) o admin (2).
router.get('/counts', requireAuth, requireRole(1, 2), getBugCounts);

// Revisión de reportes desde Gestionar laboratorios
// Registro de rutas: listar reportes de un lab y cambiar su estado. Solo instructor (1) o admin (2).
router.get('/lab/:labid', requireAuth, requireRole(1, 2), getLabBugReports);
router.patch('/:bugreportid/status', requireAuth, requireRole(1, 2), patchBugReportStatus);

export default router;