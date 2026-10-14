import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient.js';
import { AuthError } from './authService.js';
import { getLevelInfo } from './levelService.js';
import { checkBadgesSafely, getLockedBadgesSafely } from './badgeService.js';
import { logEvent } from './logService.js';

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

const ROLE_NAMES = { 0: 'estudiante', 1: 'instructor', 2: 'administrador' };

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

// Una "contraseña actual" incorrecta en un endpoint que la pide: puede ser alguien adivinándola
function logPasswordCheckFailed(actor, ip, doing) {
    logEvent({
        actor,
        ip,
        action: 'READ',
        facility: 'auth',
        event: 'PASSWORD_CHECK_FAILED',
        severity: 'warning',
        targetid: actor.userid,
        description: `Contraseña actual incorrecta al ${doing}`,
    });
}

// " junto con 2 laboratorio(s) y 5 sesión(es)", o '' si no había nada más
function describeCascade({ labCount, sessionCount }) {
    if (labCount === 0 && sessionCount === 0) return '';
    return ` junto con ${labCount} laboratorio(s) y ${sessionCount} sesión(es)`;
}

export async function updateProfile(userid, { username, firstName, lastName, email, currentPassword, ip }) {
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

    const actor = { userid, username: current.username };

    const passwordMatches = await bcrypt.compare(currentPassword, current.password);
    if (!passwordMatches) {
        logPasswordCheckFailed(actor, ip, 'editar el perfil');
        throw new AuthError(401, 'Contraseña actual incorrecta');
    }

    // Dos consultas separadas: armar un solo ".or(...)" con el correo permitiría que un correo
    // manipulado agregue condiciones propias (el formato de correo acepta "," y "()")
    const { data: sameUsername, error: usernameError } = await supabase
        .from('users')
        .select('userid')
        .eq('username', username)
        .neq('userid', userid);

    if (usernameError) throw usernameError;
    if (sameUsername.length > 0) throw new AuthError(409, 'Ese nombre de usuario ya está en uso');

    const { data: sameEmail, error: emailError } = await supabase
        .from('users')
        .select('userid')
        .eq('email', email)
        .neq('userid', userid);

    if (emailError) throw emailError;
    if (sameEmail.length > 0) throw new AuthError(409, 'Ese correo ya está registrado');

    const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({ username, firstname: firstName, lastname: lastName, email })
        .eq('userid', userid)
        .select()
        .single();

    if (updateError) throw updateError;

    // Solo se guardan los nombres de los campos (los correos y nombres son datos personales)
    const changes = [];
    if (current.username !== username) changes.push(`nombre de usuario («${current.username}» → «${username}»)`);
    if (current.firstname !== firstName || current.lastname !== lastName) changes.push('nombre');
    if (current.email !== email) changes.push('correo');

    if (changes.length > 0) {
        logEvent({
            actor,
            ip,
            action: 'UPDATE',
            facility: 'user',
            event: 'PROFILE_UPDATED',
            targetid: userid,
            description: `Actualizó su perfil: ${changes.join(', ')}`,
        });
    }

    const token = signToken(updated);
    return { token, user: toPublicUser(updated) };
}

export async function updateAvatar(userid, avatar, ip) {
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

    logEvent({
        actor: { userid, username: updated.username },
        ip,
        action: 'UPDATE',
        facility: 'user',
        event: 'AVATAR_UPDATED',
        targetid: userid,
        description: 'Cambió su avatar',
    });

    return { user: toPublicUser(updated) };
}

export async function changePassword(userid, { currentPassword, newPassword, ip }) {
    if (!currentPassword || !newPassword) {
        throw new AuthError(400, 'Debes ingresar la contraseña actual y la nueva');
    }
    if (!newPasswordRegex.test(newPassword)) {
        throw new AuthError(400, 'La nueva contraseña debe tener al menos 7 caracteres, 1 mayúscula y 1 carácter especial');
    }

    const { data: current, error: fetchError } = await supabase
        .from('users')
        .select('password, username')
        .eq('userid', userid)
        .maybeSingle();

    if (fetchError) throw fetchError;
    if (!current) throw new AuthError(404, 'Usuario no encontrado');

    const actor = { userid, username: current.username };

    const passwordMatches = await bcrypt.compare(currentPassword, current.password);
    if (!passwordMatches) {
        logPasswordCheckFailed(actor, ip, 'cambiar la contraseña');
        throw new AuthError(401, 'Contraseña actual incorrecta');
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
        .from('users')
        .update({ password: newHash })
        .eq('userid', userid);

    if (updateError) throw updateError;

    logEvent({
        actor,
        ip,
        action: 'UPDATE',
        facility: 'auth',
        event: 'PASSWORD_CHANGED',
        targetid: userid,
        description: 'Cambió su contraseña',
    });
}

export async function deleteAccount(userid, { currentPassword, ip }) {
    if (!currentPassword) {
        throw new AuthError(400, 'Debes ingresar tu contraseña actual');
    }

    const { data: current, error: fetchError } = await supabase
        .from('users')
        .select('password, username')
        .eq('userid', userid)
        .maybeSingle();

    if (fetchError) throw fetchError;
    if (!current) throw new AuthError(404, 'Usuario no encontrado');

    const actor = { userid, username: current.username };

    const passwordMatches = await bcrypt.compare(currentPassword, current.password);
    if (!passwordMatches) {
        logPasswordCheckFailed(actor, ip, 'eliminar la cuenta');
        throw new AuthError(401, 'Contraseña actual incorrecta');
    }

    const cascade = await deleteUserCascade(userid);

    logEvent({
        actor,
        ip,
        action: 'DELETE',
        facility: 'user',
        event: 'ACCOUNT_DELETED',
        targetid: userid,
        description: `Eliminó su cuenta «${current.username}»${describeCascade(cascade)}`,
    });
}

// borra al usuario en cascada (la usan deleteAccount y adminDeleteUser)
// devuelve cuántos labs y sesiones se fueron con él, para el registro de actividad
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

        // trophyuser
        const { data: labTrophies, error: trophyLookupError } = await supabase
            .from('trophy')
            .select('trophyid')
            .in('labid', labIds);
        if (trophyLookupError) throw trophyLookupError;
        const trophyIds = (labTrophies || []).map((t) => t.trophyid);

        if (trophyIds.length > 0) {
            const { error: unlockByTrophyError } = await supabase
                .from('trophyuser')
                .delete()
                .in('trophyid', trophyIds);
            if (unlockByTrophyError) throw unlockByTrophyError;

            const { error: trophyError } = await supabase
                .from('trophy')
                .delete()
                .in('trophyid', trophyIds);
            if (trophyError) throw trophyError;
        }

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

        // los zips de esos labs ya no hacen falta (si falla, solo se avisa: no debe frenar el borrado)
        const { error: zipError } = await supabase.storage
            .from('labfiles')
            .remove(labIds.map((id) => `labs/${id}/bundle.zip`));
        if (zipError) console.error('Delete lab zips error:', zipError);
    }

    // trofeos que el usuario desbloqueó (en labs de cualquier autor)
    const { error: trophyUserError } = await supabase
        .from('trophyuser')
        .delete()
        .eq('userid', userid);
    if (trophyUserError) throw trophyUserError;

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

    return { labCount: labIds.length, sessionCount: sessionIds.length };
}

export async function searchStudents(query) {
    if (typeof query !== 'string' || !query.trim()) return [];

    // misma limpieza que searchUsers: sin comas, paréntesis ni comodines dentro del filtro
    const safeQuery = query.trim().slice(0, 50).replace(/[,()*%\\]/g, '');
    if (!safeQuery) return [];

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

    // revisa si hay que asignas badges
    await checkBadgesSafely(user.userid);

    const { data: badgeRows, error: badgeError } = await supabase
        .from('userbadge')
        .select('dateofunlock, badges(badgeid, name, description, category, type)')
        .eq('userid', user.userid);

    if (badgeError) throw badgeError;

    const badges = (badgeRows || [])
        .filter((row) => row.badges)
        .map((row) => ({ ...row.badges, dateofunlock: row.dateofunlock }))
        .sort(
            (a, b) =>
                String(b.dateofunlock).localeCompare(String(a.dateofunlock)) || b.badgeid - a.badgeid
        );

    // locked badges con su progreso
    const lockedBadges = await getLockedBadgesSafely(user.userid);

    const { trophyGroups, trophyCount } = await getTrophyGroups(user.userid);

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
            lockedBadges,
            trophyGroups,
            trophyCount,
        },
    };
}

// trophies del usuario agrupados por lab
async function getTrophyGroups(userid) {
    const { data, error } = await supabase
        .from('trophyuser')
        .select('dateofunlock, trophy(trophyid, type, name, description, labid, lab(title))')
        .eq('userid', userid);

    if (error) throw error;

    const groupsByLab = new Map();

    (data || []).forEach(({ dateofunlock, trophy }) => {
        if (!trophy) return;

        if (!groupsByLab.has(trophy.labid)) {
            groupsByLab.set(trophy.labid, {
                labid: trophy.labid,
                title: trophy.lab?.title ?? 'Laboratorio',
                lastUnlock: dateofunlock,
                trophies: [],
            });
        }

        const group = groupsByLab.get(trophy.labid);
        if (dateofunlock > group.lastUnlock) group.lastUnlock = dateofunlock;

        group.trophies.push({
            trophyid: trophy.trophyid,
            type: trophy.type,
            name: trophy.name,
            description: trophy.description,
            dateofunlock,
        });
    });

    const trophyGroups = [...groupsByLab.values()]
        .map((group) => ({
            ...group,
            trophies: group.trophies.sort((a, b) => b.type - a.type || a.trophyid - b.trophyid),
        }))
        .sort((a, b) => b.lastUnlock.localeCompare(a.lastUnlock) || b.labid - a.labid);

    const trophyCount = trophyGroups.reduce((total, group) => total + group.trophies.length, 0);

    return { trophyGroups, trophyCount };
}

export async function searchUsers(query) {
    if (typeof query !== 'string' || !query.trim()) return [];

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

// denial: { ip, action, verb } solo sirve para el registro de actividad
function assertCanManage(reqUser, target, denial) {
    if (target.userid === reqUser.userid) {
        throw new AuthError(403, 'No puedes gestionar tu propia cuenta desde aquí; usa "Mi perfil"');
    }
    if (reqUser.role === 1 && target.role !== 0) {
        logEvent({
            actor: reqUser,
            ip: denial.ip,
            action: denial.action,
            facility: 'user',
            event: 'USER_ACCESS_DENIED',
            severity: 'warning',
            targetid: target.userid,
            description: `Intentó ${denial.verb} la cuenta #${target.userid}, que no es de un estudiante`,
        });
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

export async function adminUpdateUser(reqUser, targetId, { username, firstName, lastName, email, role, ip }) {
    const target = await getTargetUser(targetId);
    assertCanManage(reqUser, target, { ip, action: 'UPDATE', verb: 'modificar' });

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
    let newRole = null;

    // solo el admin puede cambiar roles.
    if (role !== undefined && role !== null && Number(role) !== target.role) {
        if (reqUser.role !== 2) {
            logEvent({
                actor: reqUser,
                ip,
                action: 'UPDATE',
                facility: 'user',
                event: 'ROLE_CHANGE_DENIED',
                severity: 'warning',
                targetid: target.userid,
                description: `Intentó cambiar el rol de «${target.username}» (#${target.userid}) sin ser administrador`,
            });
            throw new AuthError(403, 'Solo un administrador puede cambiar roles');
        }
        if (!VALID_ROLES.includes(Number(role))) {
            throw new AuthError(400, 'Rol inválido');
        }
        changes.role = Number(role);
        newRole = Number(role);
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

    // Solo se guardan los nombres de los campos (los correos y nombres son datos personales)
    const edited = [];
    if (target.username !== username) edited.push(`nombre de usuario («${target.username}» → «${username}»)`);
    if (target.firstname !== firstName || target.lastname !== lastName) edited.push('nombre');
    if (target.email !== email) edited.push('correo');

    if (edited.length > 0) {
        logEvent({
            actor: reqUser,
            ip,
            action: 'UPDATE',
            facility: 'user',
            event: 'USER_UPDATED',
            targetid: target.userid,
            description: `Modificó la cuenta de «${target.username}» (#${target.userid}): ${edited.join(', ')}`,
        });
    }

    if (newRole !== null) {
        logEvent({
            actor: reqUser,
            ip,
            action: 'UPDATE',
            facility: 'user',
            event: 'ROLE_CHANGED',
            severity: 'warning',
            targetid: target.userid,
            description: `Cambió el rol de «${target.username}» (#${target.userid}) de ${ROLE_NAMES[target.role]} a ${ROLE_NAMES[newRole]}`,
        });
    }

    return { user: updated };
}

export async function adminDeleteUser(reqUser, targetId, ip) {
    const target = await getTargetUser(targetId);
    assertCanManage(reqUser, target, { ip, action: 'DELETE', verb: 'eliminar' });

    const cascade = await deleteUserCascade(target.userid);

    logEvent({
        actor: reqUser,
        ip,
        action: 'DELETE',
        facility: 'user',
        event: 'USER_DELETED',
        severity: 'warning',
        targetid: target.userid,
        description: `Eliminó la cuenta de «${target.username}» (#${target.userid})${describeCascade(cascade)}`,
    });
}