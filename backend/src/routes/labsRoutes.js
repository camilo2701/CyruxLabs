// Este archivo se encarga de definir las rutas HTTP de los laboratorios y de
// enlazar cada una con su controlador, aplicando los middlewares de autenticación
// y de rol (requireAuth/requireRole) y la subida del zip cuando corresponde.

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

// Esta ruta se encarga de crear un laboratorio (requiere instructor/admin y el zip subido).
router.post('/', requireAuth, requireRole(1, 2), uploadLabZip, createLab);
// Esta ruta se encarga de comprobar si ya existe un lab con un título dado (público).
router.get('/check-title', checkTitleDuplicate);
// Esta ruta se encarga del listado público de laboratorios (sin login).
router.get('/', getAllLabs);
// Esta ruta se encarga del listado de gestión de laboratorios.
// Gestionar laboratorios: admin ve todos, instructor solo los suyos
router.get('/manage', requireAuth, requireRole(1, 2), getManagedLabs);
// Esta ruta se encarga de entregar un lab para su pantalla de edición.
// Todo lo que la pantalla de edición necesita de un lab (instrucciones, trofeos, flag, actualización pendiente)
router.get('/:labid/manage', requireAuth, requireRole(1, 2), getLabForEdit);
// Esta ruta se encarga de actualizar los datos editables de un lab.
router.put('/:labid', requireAuth, requireRole(1, 2), updateLab);
// Esta ruta se encarga de programar un nuevo zip + flag para el lab.
// Nuevo zip + flag: se programan y se aplican cuando el lab no tiene sesiones abiertas
router.post('/:labid/update-request', requireAuth, requireRole(1, 2), uploadLabZip, requestFileUpdate);
// Esta ruta se encarga de cancelar la actualización pendiente del lab.
router.delete('/:labid/update-request', requireAuth, requireRole(1, 2), cancelFileUpdate);
// Esta ruta se encarga de forzar la aplicación inmediata de la actualización pendiente.
// Solo admin: aplica ya la actualización pendiente cerrando las sesiones abiertas
router.post('/:labid/update-request/apply-now', requireAuth, requireRole(2), forceApplyFileUpdate);
// Esta ruta se encarga de eliminar (marcar como borrado) un laboratorio.
router.delete('/:labid', requireAuth, requireRole(1, 2), deleteLab);

export default router;
