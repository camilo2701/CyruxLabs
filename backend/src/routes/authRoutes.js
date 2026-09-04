import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);

// Ejemplo de ruta protegida: sirve para probar que el token funciona
// y como base para el futuro endpoint del Dashboard.
router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

export default router;