// Este archivo se encarga de definir las rutas de autenticación (/register, /login)
// y la ruta protegida /me que devuelve el usuario actual a partir de su token.

import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { supabase } from '../config/supabaseClient.js';
import { toPublicUser } from '../services/authService.js';

const router = Router();

// Esta ruta se encarga de registrar un nuevo usuario.
router.post('/register', register);
// Esta ruta se encarga de iniciar sesión y entregar el token de autenticación.
router.post('/login', login);

// Esta ruta se encarga de devolver el usuario actual (ya autenticado) leído de la BD.
// Ejemplo de ruta protegida: sirve para probar que el token funciona
// y como base para el futuro endpoint del Dashboard.
// Devuelve el usuario actualizado desde la base de datos (el frontend lo usa al cargar la app)
router.get('/me', requireAuth, async (req, res) => {
    try {
        // Consulta a Supabase: busca el usuario por el id que viene dentro del token
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('userid', req.user.userid)
            .maybeSingle();

        if (error) throw error;
        if (!user) return res.status(401).json({ error: 'La cuenta ya no existe', code: 'SESSION_INVALID' });

        return res.json({ user: toPublicUser(user) });
    } catch (err) {
        console.error('Error obteniendo el usuario actual:', err);
        return res.status(500).json({ error: 'Error interno al obtener el usuario' });
    }
});

export default router;