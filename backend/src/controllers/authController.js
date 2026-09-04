import { registerUser, loginUser, AuthError } from '../services/authService.js';

export async function register(req, res) {
    try {
        const { username, email, firstName, lastName, password } = req.body;
        const result = await registerUser({ username, email, firstName, lastName, password });
        return res.status(201).json(result);
    } catch (err) {
        if (err instanceof AuthError) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error('Error en register:', err);
        return res.status(500).json({ error: 'Error interno al registrar el usuario' });
    }
}

export async function login(req, res) {
    try {
        const { email, password } = req.body;
        const result = await loginUser({ email, password });
        return res.status(200).json(result);
    } catch (err) {
        if (err instanceof AuthError) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error('Error en login:', err);
        return res.status(500).json({ error: 'Error interno al iniciar sesión' });
    }
}