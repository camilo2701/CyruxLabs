// Este archivo se encarga de los controladores HTTP de autenticación (registro e inicio de
// sesión): leen la petición, llaman al servicio de auth y traducen el resultado a respuestas HTTP.
import { registerUser, loginUser, AuthError } from '../services/authService.js';
import { clientIp } from '../services/logService.js';

// Este controlador se encarga de registrar un nuevo usuario y responder 201 con el resultado,
// o un error adecuado si el registro falla.
export async function register(req, res) {
    try {
        const { username, email, firstName, lastName, password } = req.body;
        const result = await registerUser({
            username, email, firstName, lastName, password, ip: clientIp(req),
        });
        return res.status(201).json(result);
    } catch (err) {
        // Los AuthError llevan su propio código HTTP; cualquier otro error se trata como 500.
        if (err instanceof AuthError) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error('Error en register:', err);
        return res.status(500).json({ error: 'Error interno al registrar el usuario' });
    }
}

// Este controlador se encarga de iniciar sesión y responder 200 con el resultado, o un error
// adecuado si las credenciales fallan.
export async function login(req, res) {
    try {
        const { email, password } = req.body;
        const result = await loginUser({ email, password, ip: clientIp(req) });
        return res.status(200).json(result);
    } catch (err) {
        // Los AuthError llevan su propio código HTTP y pueden incluir datos extra; el resto es 500.
        if (err instanceof AuthError) {
            return res.status(err.status).json({ error: err.message, ...err.extra });
        }
        console.error('Error en login:', err);
        return res.status(500).json({ error: 'Error interno al iniciar sesión' });
    }
}