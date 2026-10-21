import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient.js';

function sessionInvalid(res, message) {
    return res.status(401).json({ error: message, code: 'SESSION_INVALID' });
}

export async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sessionInvalid(res, 'No se envió un token de autenticación');
    }

    const token = authHeader.split(' ')[1];

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
        return sessionInvalid(res, 'Token inválido o expirado');
    }

    try {
        // si cambia el rol o se elimina la cuenta aplica de inmediato
        const { data: user, error } = await supabase
            .from('users')
            .select('userid, username, role')
            .eq('userid', payload.userid)
            .maybeSingle();

        if (error) throw error;
        if (!user) return sessionInvalid(res, 'La cuenta ya no existe');

        // Queda disponible en cualquier ruta protegida como req.user
        req.user = { userid: user.userid, username: user.username, role: user.role };
        next();
    } catch (err) {
        console.error('Error verificando la sesión:', err);
        return res.status(500).json({ error: 'Error interno al verificar la sesión' });
    }
}

export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
        }
        next();
    };
}