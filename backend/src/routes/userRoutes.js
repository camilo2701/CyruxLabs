// Este archivo se encarga de definir las rutas de usuarios: el perfil propio (verlo, editarlo,
// cambiar avatar/contraseña y darse de baja), la búsqueda y consulta de estudiantes, y la
// gestión de usuarios reservada al personal (listar, editar y eliminar), protegiendo cada ruta
// con la autenticación y el rol necesarios.

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { putProfile, putAvatar, putPassword, deleteMe, getStudents, getProfile, getUserSearch,
    getManagedUsers, putManagedUser, deleteManagedUser } from '../controllers/userController.js';

const router = Router();

// Rutas sobre la propia cuenta: todas requieren estar autenticado
router.put('/me', requireAuth, putProfile);
router.put('/me/avatar', requireAuth, putAvatar);
router.put('/me/password', requireAuth, putPassword);
router.delete('/me', requireAuth, deleteMe);
// Listado de estudiantes: solo para profesor (1) o administrador (2)
router.get('/students', requireAuth, requireRole(1, 2), getStudents);

// Búsqueda de usuarios y consulta de un perfil por nombre de usuario
router.get('/search', requireAuth, getUserSearch);
router.get('/profile/:username', requireAuth, getProfile);

// Gestión de usuarios por parte del personal (profesor o administrador): listar, editar y eliminar
router.get('/manage', requireAuth, requireRole(1, 2), getManagedUsers);
router.put('/manage/:userid', requireAuth, requireRole(1, 2), putManagedUser);
router.delete('/manage/:userid', requireAuth, requireRole(1, 2), deleteManagedUser);

export default router;
