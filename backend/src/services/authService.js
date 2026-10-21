import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient.js';
import { checkBadgesSafely } from './badgeService.js';
import { logEvent } from './logService.js';

const SALT_ROUNDS = 10;
const DEFAULT_AVATAR = 'avatar-01.svg';

const usernameRegex = /^[a-zA-Z0-9.-]{1,12}$/;
const nameRegex = /^\p{L}+$/u;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,20}$/;

export class AuthError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

// bloqueo por intentos fallidos de inicio de sesión
const MAX_LOGIN_ATTEMPTS = 3;
const LOCK_MINUTES = 15;

function lockedError(lockedUntil) {
    const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
    return new AuthError(
        423,
        `Acceso bloqueado por ${MAX_LOGIN_ATTEMPTS} intentos fallidos. Intenta de nuevo más tarde.`,
        { lockedUntil: lockedUntil.toISOString(), retryAfterSeconds }
    );
}

export function signToken(user) {
    return jwt.sign(
        { userid: user.userid, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
}

export function toPublicUser(user) {
    // NO devolver el hash de la contraseña al cliente
    const { password, failedattempts, lockeduntil, ...publicUser } = user;
    return publicUser;
}

function validateRegisterInput({ username, email, firstName, lastName, password }) {
    if (!username || !email || !firstName || !lastName || !password) {
        throw new AuthError(400, 'Todos los campos son obligatorios');
    }
    if (!usernameRegex.test(username)) {
        throw new AuthError(400, 'Nombre de usuario inválido (solo letras, números, puntos y guiones, máx 12)');
    }
    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
        throw new AuthError(400, 'Nombre y apellido solo pueden contener letras');
    }
    if (!emailRegex.test(email)) {
        throw new AuthError(400, 'Formato de correo inválido');
    }
    if (!passwordRegex.test(password)) {
        throw new AuthError(400, 'La contraseña debe tener 8-20 caracteres, al menos 1 mayúscula, 1 número y 1 carácter especial');
    }
}

// ip: para el registro de actividad (la pasa el controller)
export async function registerUser({ username, email, firstName, lastName, password, ip }) {
    validateRegisterInput({ username, email, firstName, lastName, password });

    // Dos consultas separadas: armar un solo ".or(...)" con el correo permitiría que un correo
    // manipulado agregue condiciones propias (el formato de correo acepta "," y "()")
    const { data: usernameMatch, error: usernameError } = await supabase
        .from('users')
        .select('userid')
        .eq('username', username)
        .limit(1);

    if (usernameError) throw usernameError;

    if (usernameMatch.length > 0) {
        throw new AuthError(409, 'Ese nombre de usuario ya está en uso');
    }

    const { data: emailMatch, error: emailError } = await supabase
        .from('users')
        .select('userid')
        .eq('email', email)
        .limit(1);

    if (emailError) throw emailError;

    if (emailMatch.length > 0) {
        throw new AuthError(409, 'Ese correo ya está registrado');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const { data: created, error: insertError } = await supabase
        .from('users')
        .insert({
            username,
            firstname: firstName,
            lastname: lastName,
            password: passwordHash,
            avatar: DEFAULT_AVATAR,
            email,
            dateofcreation: new Date().toISOString().slice(0, 10),
            role: 0,
            level: 1,
            score: 0,
        })
        .select()
        .single();

    if (insertError) throw insertError;

    logEvent({
        actor: { userid: created.userid, username: created.username },
        ip,
        action: 'CREATE',
        facility: 'user',
        event: 'USER_REGISTERED',
        targetid: created.userid,
        description: `Registró la cuenta «${created.username}»`,
    });

    // insignia "bienvenido"
    await checkBadgesSafely(created.userid);

    const token = signToken(created);
    return { token, user: toPublicUser(created) };
}

// ip: para el registro de actividad (la pasa el controller)
export async function loginUser({ email, password, ip }) {
    if (!email || !password) {
        throw new AuthError(400, 'Email y contraseña son obligatorios');
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
        throw new AuthError(400, 'Email o contraseña no válidos');
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (error) throw error;

    if (!user) {
        // No se guarda el correo escrito: puede ser de otra persona o una contraseña pegada por error
        logEvent({
            ip,
            action: 'READ',
            facility: 'auth',
            event: 'LOGIN_FAILED',
            severity: 'warning',
            description: 'Intento de inicio de sesión con un correo no registrado',
        });
        throw new AuthError(401, 'Email o contraseña incorrectos');
    }

    // ni siquiera la contraseña correcta entra durante el bloqueo
    // (estos intentos no se registran: el bloqueo ya quedó registrado y evita llenar el log)
    const lockedUntil = user.lockeduntil ? new Date(user.lockeduntil) : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
        throw lockedError(lockedUntil);
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    const actor = { userid: user.userid, username: user.username };

    // contraseña incorrecta suma un intento y bloquea al llegar al máximo
    if (!passwordMatches) {
        const attempts = (user.failedattempts || 0) + 1;

        if (attempts >= MAX_LOGIN_ATTEMPTS) {
            const newLockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
            // al terminar el bloqueo vuelve a tener 3 intentos
            const { error: lockError } = await supabase
                .from('users')
                .update({ failedattempts: 0, lockeduntil: newLockedUntil.toISOString() })
                .eq('userid', user.userid);
            if (lockError) throw lockError;

            logEvent({
                actor,
                ip,
                action: 'UPDATE',
                facility: 'auth',
                event: 'ACCOUNT_LOCKED',
                severity: 'warning',
                targetid: user.userid,
                description: `Cuenta bloqueada ${LOCK_MINUTES} minutos tras ${MAX_LOGIN_ATTEMPTS} intentos fallidos`,
            });

            throw lockedError(newLockedUntil);
        }

        const { error: attemptError } = await supabase
            .from('users')
            .update({ failedattempts: attempts })
            .eq('userid', user.userid);
        if (attemptError) throw attemptError;

        logEvent({
            actor,
            ip,
            action: 'READ',
            facility: 'auth',
            event: 'LOGIN_FAILED',
            severity: 'warning',
            targetid: user.userid,
            description: `Contraseña incorrecta (intento ${attempts} de ${MAX_LOGIN_ATTEMPTS})`,
        });

        const remaining = MAX_LOGIN_ATTEMPTS - attempts;
        throw new AuthError(
            401,
            `Email o contraseña incorrectos. Te ${remaining === 1 ? 'queda 1 intento' : `quedan ${remaining} intentos`}.`,
            { remainingAttempts: remaining }
        );
    }

    // login correcto limpia el contador y cualquier bloqueo vencido
    if (user.failedattempts || user.lockeduntil) {
        const { error: resetError } = await supabase
            .from('users')
            .update({ failedattempts: 0, lockeduntil: null })
            .eq('userid', user.userid);
        if (resetError) throw resetError;
    }

    const token = signToken(user);

    logEvent({
        actor,
        ip,
        action: 'CREATE',
        facility: 'auth',
        event: 'LOGIN_OK',
        targetid: user.userid,
        description: 'Inició sesión',
    });

    return { token, user: toPublicUser(user) };
}