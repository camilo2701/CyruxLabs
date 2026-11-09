// Este archivo se encarga de definir la ruta para consultar el registro de actividad (solo admin).
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { listLogs } from '../controllers/logController.js';

const router = Router();

// Registro de ruta: lista los logs. Requiere sesión y rol admin (2).
router.get('/', requireAuth, requireRole(2), listLogs);

export default router;