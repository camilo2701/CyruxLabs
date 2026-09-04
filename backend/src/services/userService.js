import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient.js';
import { AuthError } from './authService.js';

const usernameRegex = /^[a-zA-Z0-9.-]{1,12}$/;
const nameRegex = /^\p{L}+$/u;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mismo criterio que ya usa ChangePassword.jsx en el frontend: 7+ caracteres,
// una mayúscula y un carácter especial (no exige número).
const newPasswordRegex = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{7,}$/;

const ALLOWED_AVATARS = [
    'avatar-01.svg',
    'avatar-02.svg',
    'avatar-03.svg',
    'avatar-04.svg',
    'avatar-05.svg',
];

function signToken(user) {
    return jwt.sign(
        { userid: user.userid, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

function toPublicUser(user) {
    const { password, ...publicUser } = user;
    return publicUser;
}

export async function updateProfile(userid, { username, firstName, lastName, email, currentPassword }) {
    if (!username || !firstName || !lastName || !email || !currentPassword) {
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

    const { data: current, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('userid', userid)
        .maybeSingle();

    if (fetchError) throw fetchError;
    if (!current) throw new AuthError(404, 'Usuario no encontrado');

    const passwordMatches = await bcrypt.compare(currentPassword, current.password);
    if (!passwordMatches) {
        throw new AuthError(401, 'Contraseña actual incorrecta');
    }

    // Como la tabla no tiene UNIQUE, revisamos duplicados a mano,
    // excluyendo al propio usuario.
    const { data: existing, error: lookupError } = await supabase
        .from('users')
        .select('userid, username, email')
        .or(`username.eq.${username},email.eq.${email}`)
        .neq('userid', userid);

    if (lookupError) throw lookupError;
    if (existing && existing.length > 0) {
        const usernameTaken = existing.some((u) => u.username === username);
        throw new AuthError(
            409,
            usernameTaken ? 'Ese nombre de usuario ya está en uso' : 'Ese correo ya está registrado'
        );
    }

    const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({ username, firstname: firstName, lastname: lastName, email })
        .eq('userid', userid)
        .select()
        .single();

    if (updateError) throw updateError;

    // El username va dentro del JWT, así que si cambió, hay que reemitir el token.
    const token = signToken(updated);
    return { token, user: toPublicUser(updated) };
}

export async function updateAvatar(userid, avatar) {
    if (!ALLOWED_AVATARS.includes(avatar)) {
        throw new AuthError(400, 'Avatar inválido');
    }

    const { data: updated, error } = await supabase
        .from('users')
        .update({ avatar })
        .eq('userid', userid)
        .select()
        .single();

    if (error) throw error;

    return { user: toPublicUser(updated) };
}

export async function changePassword(userid, { currentPassword, newPassword }) {
    if (!currentPassword || !newPassword) {
        throw new AuthError(400, 'Debes ingresar la contraseña actual y la nueva');
    }
    if (!newPasswordRegex.test(newPassword)) {
        throw new AuthError(400, 'La nueva contraseña debe tener al menos 7 caracteres, 1 mayúscula y 1 carácter especial');
    }

    const { data: current, error: fetchError } = await supabase
        .from('users')
        .select('password')
        .eq('userid', userid)
        .maybeSingle();

    if (fetchError) throw fetchError;
    if (!current) throw new AuthError(404, 'Usuario no encontrado');

    const passwordMatches = await bcrypt.compare(currentPassword, current.password);
    if (!passwordMatches) {
        throw new AuthError(401, 'Contraseña actual incorrecta');
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
        .from('users')
        .update({ password: newHash })
        .eq('userid', userid);

    if (updateError) throw updateError;
}