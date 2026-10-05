import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient.js';
import { AuthError } from './authService.js';
import { getLevelInfo } from './levelService.js';

const usernameRegex = /^[a-zA-Z0-9.-]{1,12}$/;
const nameRegex = /^\p{L}+$/u;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
    const { password, failedattempts, lockeduntil, ...publicUser } = user;
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

export async function deleteAccount(userid, { currentPassword }) {
    if (!currentPassword) {
        throw new AuthError(400, 'Debes ingresar tu contraseña actual');
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

    await deleteUserCascade(userid);
}

// borra al usuario en cascada (la usan deleteAccount y adminDeleteUser)
async function deleteUserCascade(userid) {
    // labs creados por el usuario
    const { data: labs, error: labsLookupError } = await supabase
        .from('lab')
        .select('labid')
        .eq('userid', userid);
    if (labsLookupError) throw labsLookupError;
    const labIds = (labs || []).map((l) => l.labid);

    // sesiones a borrar: las del usuario + otros usuarios si tenia un lab
    let sessionQuery = supabase.from('session').select('sessionid');
    sessionQuery = labIds.length > 0
        ? sessionQuery.or(`userid.eq.${userid},labid.in.(${labIds.join(',')})`)
        : sessionQuery.eq('userid', userid);
    const { data: sessions, error: sessionsLookupError } = await sessionQuery;
    if (sessionsLookupError) throw sessionsLookupError;
    const sessionIds = (sessions || []).map((s) => s.sessionid);

    // report depende de session
    if (sessionIds.length > 0) {
        const { error: reportError } = await supabase
            .from('report')
            .delete()
            .in('sessionid', sessionIds);
        if (reportError) throw reportError;

        const { error: sessionError } = await supabase
            .from('session')
            .delete()
            .in('sessionid', sessionIds);
        if (sessionError) throw sessionError;
    }

    // bugreport tiene FK a users y a lab
    const { error: bugByUserError } = await supabase
        .from('bugreport')
        .delete()
        .eq('userid', userid);
    if (bugByUserError) throw bugByUserError;

    if (labIds.length > 0) {
        const { error: bugByLabError } = await supabase
            .from('bugreport')
            .delete()
            .in('labid', labIds);
        if (bugByLabError) throw bugByLabError;

        // 5) benefit depende de lab
        const { error: benefitError } = await supabase
            .from('benefit')
            .delete()
            .in('labid', labIds);
        if (benefitError) throw benefitError;

        const { error: labError } = await supabase
            .from('lab')
            .delete()
            .in('labid', labIds);
        if (labError) throw labError;
    }

    // badges
    const { error: badgeError } = await supabase
        .from('userbadge')
        .delete()
        .eq('userid', userid);
    if (badgeError) throw badgeError;

    const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('userid', userid);
    if (userError) throw userError;
}

export async function searchStudents(query) {
    if (!query || !query.trim()) return [];

    const safeQuery = query.trim().replace(/,/g, '');

    const { data, error } = await supabase
        .from('users')
        .select('userid, username, firstname, lastname')
        .eq('role', 0)
        .or(`username.ilike.%${safeQuery}%,firstname.ilike.%${safeQuery}%,lastname.ilike.%${safeQuery}%`);

    if (error) throw error;

    return data;
}

export async function getPublicProfile(username) {
    if (!username || !usernameRegex.test(username)) {
        throw new AuthError(404, 'Usuario no encontrado');
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('userid, username, avatar, role, level, score, dateofcreation')
        .eq('username', username)
        .maybeSingle();

    if (error) throw error;
    if (!user) throw new AuthError(404, 'Usuario no encontrado');

    const { data: badgeRows, error: badgeError } = await supabase
        .from('userbadge')
        .select('badges(*)')
        .eq('userid', user.userid);

    if (badgeError) throw badgeError;

    const badges = (badgeRows || [])
        .map((row) => row.badges)
        .filter(Boolean)
        .sort((a, b) => a.badgeid - b.badgeid);

    const levelInfo = getLevelInfo(user.score);

    return {
        profile: {
            userid: user.userid,
            username: user.username,
            avatar: user.avatar,
            role: user.role,
            dateofcreation: user.dateofcreation,
            ...levelInfo,
            badges,
        },
    };
}

export async function searchUsers(query) {
    if (!query || !query.trim()) return [];

    // Quitamos caracteres que rompen el filtro .or() de PostgREST.
    const safeQuery = query.trim().slice(0, 50).replace(/[,()*%]/g, '');
    if (!safeQuery) return [];

    const { data, error } = await supabase
        .from('users')
        .select('userid, username, avatar, level, role')
        .ilike('username', `%${safeQuery}%`)
        .order('username', { ascending: true })
        .limit(10);

    if (error) throw error;
    return data;
}

// gestion de usuarios
const VALID_ROLES = [0, 1, 2];
const MANAGE_FIELDS = 'userid, username, firstname, lastname, email, role, avatar, level, dateofcreation';
const RECENT_LIMIT = 5;
const PAGE_SIZE = 10;

function assertCanManage(reqUser, target) {
    if (target.userid === reqUser.userid) {
        throw new AuthError(403, 'No puedes gestionar tu propia cuenta desde aquí; usa "Mi perfil"');
    }
    if (reqUser.role === 1 && target.role !== 0) {
        throw new AuthError(403, 'Los instructores solo pueden gestionar estudiantes');
    }
    if (reqUser.role !== 1 && reqUser.role !== 2) {
        throw new AuthError(403, 'No tienes permisos para realizar esta acción');
    }
}

async function getTargetUser(targetId) {
    const id = Number(targetId);
    if (!Number.isInteger(id) || id <= 0) throw new AuthError(400, 'ID de usuario inválido');

    const { data, error } = await supabase
        .from('users')
        .select(MANAGE_FIELDS)
        .eq('userid', id)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new AuthError(404, 'Usuario no encontrado');
    return data;
}

// sin busqueda los ultimos 5 usuarios registrados
// con busqueda resultados paginados por usuario, nombre o apellido.
export async function listManagedUsers(reqUser, { search = '', page = 1 } = {}) {
    const safeQuery = String(search).trim().slice(0, 100).replace(/[,()*%\\]/g, '');
    const isSearch = safeQuery.length > 0;

    let query = supabase
        .from('users')
        .select(MANAGE_FIELDS, { count: 'exact' })
        .neq('userid', reqUser.userid);

    if (reqUser.role === 1) query = query.eq('role', 0);

    if (isSearch) {
        query = query.or(
            `username.ilike.%${safeQuery}%,firstname.ilike.%${safeQuery}%,lastname.ilike.%${safeQuery}%`
        );
    }

    query = query
        .order('dateofcreation', { ascending: false })
        .order('userid', { ascending: false });

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    query = isSearch
        ? query.range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)
        : query.limit(RECENT_LIMIT);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
        users: data,
        total: isSearch ? count : data.length,
        page: isSearch ? currentPage : 1,
        pageSize: isSearch ? PAGE_SIZE : RECENT_LIMIT,
        totalPages: isSearch ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1,
    };
}

export async function adminUpdateUser(reqUser, targetId, { username, firstName, lastName, email, role }) {
    const target = await getTargetUser(targetId);
    assertCanManage(reqUser, target);

    if (!username || !firstName || !lastName || !email) {
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

    const changes = { username, firstname: firstName, lastname: lastName, email };

    // solo el admin puede cambiar roles.
    if (role !== undefined && role !== null && Number(role) !== target.role) {
        if (reqUser.role !== 2) {
            throw new AuthError(403, 'Solo un administrador puede cambiar roles');
        }
        if (!VALID_ROLES.includes(Number(role))) {
            throw new AuthError(400, 'Rol inválido');
        }
        changes.role = Number(role);
    }

    const { data: sameUsername, error: usernameError } = await supabase
        .from('users')
        .select('userid')
        .eq('username', username)
        .neq('userid', target.userid);
    if (usernameError) throw usernameError;
    if (sameUsername.length > 0) throw new AuthError(409, 'Ese nombre de usuario ya está en uso');

    const { data: sameEmail, error: emailError } = await supabase
        .from('users')
        .select('userid')
        .eq('email', email)
        .neq('userid', target.userid);
    if (emailError) throw emailError;
    if (sameEmail.length > 0) throw new AuthError(409, 'Ese correo ya está registrado');

    const { data: updated, error: updateError } = await supabase
        .from('users')
        .update(changes)
        .eq('userid', target.userid)
        .select(MANAGE_FIELDS)
        .single();

    if (updateError) throw updateError;
    return { user: updated };
}

export async function adminDeleteUser(reqUser, targetId) {
    const target = await getTargetUser(targetId);
    assertCanManage(reqUser, target);
    await deleteUserCascade(target.userid);
}