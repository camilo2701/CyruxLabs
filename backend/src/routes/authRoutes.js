import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { supabase } from '../config/supabaseClient.js';
import { toPublicUser } from '../services/authService.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);

// Ejemplo de ruta protegida: sirve para probar que el token funciona
// y como base para el futuro endpoint del Dashboard.
// Devuelve el usuario actualizado desde la base de datos (el frontend lo usa al cargar la app)
router.get('/me', requireAuth, async (req, res) => {
    try {
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