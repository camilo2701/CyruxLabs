import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient.js';

const SALT_ROUNDS = 10;
const DEFAULT_AVATAR = 'avatar-01.svg';

// Mismas reglas de formato que ya usas en el frontend (RegisterPage.jsx),
// repetidas aquí porque el backend nunca debe confiar solo en la
// validación del cliente.
const usernameRegex = /^[a-zA-Z0-9.-]{1,12}$/;
const nameRegex = /^\p{L}+$/u;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,20}$/;

// Errores "esperados" (datos inválidos, duplicados, credenciales
// incorrectas). El controller los detecta y responde con el status
// correcto en vez de un 500 genérico.
export class AuthError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export function signToken(user) {
    return jwt.sign(
        { userid: user.userid, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

function toPublicUser(user) {
    // Nunca devolver el hash de la contraseña al cliente
    const { password, ...publicUser } = user;
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

export async function registerUser({ username, email, firstName, lastName, password }) {
    validateRegisterInput({ username, email, firstName, lastName, password });

    // Como la tabla no tiene UNIQUE en username/email, verificamos
    // duplicados manualmente antes de insertar.
    const { data: existing, error: lookupError } = await supabase
        .from('users')
        .select('userid, username, email')
        .or(`username.eq.${username},email.eq.${email}`);

    if (lookupError) throw lookupError;

    if (existing && existing.length > 0) {
        const usernameTaken = existing.some((u) => u.username === username);
        throw new AuthError(
            409,
            usernameTaken ? 'Ese nombre de usuario ya está en uso' : 'Ese correo ya está registrado'
        );
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
            level: 0,
            score: 0,
        })
        .select()
        .single();

    if (insertError) throw insertError;

    const token = signToken(created);
    return { token, user: toPublicUser(created) };
}

export async function loginUser({ email, password }) {
    if (!email || !password) {
        throw new AuthError(400, 'Email y contraseña son obligatorios');
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (error) throw error;

    // Mismo mensaje si el usuario no existe o la contraseña es incorrecta,
    // para no revelar cuál de los dos fue el problema.
    if (!user) {
        throw new AuthError(401, 'Email o contraseña incorrectos');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
        throw new AuthError(401, 'Email o contraseña incorrectos');
    }

    const token = signToken(user);
    return { token, user: toPublicUser(user) };
}