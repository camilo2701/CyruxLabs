import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No se envió un token de autenticación' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        // Queda disponible en cualquier ruta protegida como req.user
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

// Se usa DESPUÉS de requireAuth en la ruta, ej:
// router.get('/algo', requireAuth, requireRole(1, 2), handler)
// Roles: 0 = student, 1 = instructor, 2 = admin
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
        }
        next();
    };
}