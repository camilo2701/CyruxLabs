// Este archivo se encarga de definir las rutas de las sesiones de laboratorio (listar, ver detalle y
// reporte, iniciar, detener, reiniciar y enviar la flag), protegidas con autenticación y roles.
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
    getSessionReport,
} from '../controllers/sessionController.js';

const router = Router();

// Sesiones propias del usuario y, solo para instructores/admins, las de otro usuario
router.get('/me', requireAuth, getMySessions);
router.get('/user/:userid', requireAuth, requireRole(1, 2), getSessionsByUserId);

// Detalle, reporte de evidencia y envío de la flag de una sesión
router.get('/:sessionid/report', requireAuth, getSessionReport);
router.get('/:sessionid', requireAuth, getSessionDetails);
router.post('/submit-flag', requireAuth, postSubmitFlag);

// Control del ciclo de vida de la sesión: iniciar, detener y reiniciar el laboratorio
router.post('/start', requireAuth, postStartSession);
router.post('/stop', requireAuth, postStopSession);
router.post('/restart', requireAuth, postRestartSession);

export default router;