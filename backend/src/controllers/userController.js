import { updateProfile, updateAvatar, changePassword, deleteAccount, searchStudents } from '../services/userService.js';
import { AuthError } from '../services/authService.js';

export async function putProfile(req, res) {
    try {
        const { username, firstName, lastName, email, currentPassword } = req.body;
        const result = await updateProfile(req.user.userid, {
            username,
            firstName,
            lastName,
            email,
            currentPassword,
        });
        return res.status(200).json(result);
    } catch (err) {
        if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
        console.error('Error actualizando perfil:', err);
        return res.status(500).json({ error: 'Error interno al actualizar el perfil' });
    }
}

export async function putAvatar(req, res) {
    try {
        const { avatar } = req.body;
        const result = await updateAvatar(req.user.userid, avatar);
        return res.status(200).json(result);
    } catch (err) {
        if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
        console.error('Error actualizando avatar:', err);
        return res.status(500).json({ error: 'Error interno al actualizar el avatar' });
    }
}

export async function putPassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        await changePassword(req.user.userid, { currentPassword, newPassword });
        return res.status(200).json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
        if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
        console.error('Error cambiando contraseña:', err);
        return res.status(500).json({ error: 'Error interno al cambiar la contraseña' });
    }
}

export async function deleteMe(req, res) {
    try {
        const { currentPassword } = req.body;
        await deleteAccount(req.user.userid, { currentPassword });
        return res.status(200).json({ message: 'Cuenta eliminada correctamente' });
    } catch (err) {
        if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
        console.error('Error eliminando cuenta:', err);
        return res.status(500).json({ error: 'Error interno al eliminar la cuenta' });
    }
}

export async function getStudents(req, res) {
    try {
        const { search = '' } = req.query;
        const students = await searchStudents(search);
        return res.status(200).json({ students });
    } catch (err) {
        console.error('Error buscando estudiantes:', err);
        return res.status(500).json({ error: 'Error interno al buscar estudiantes' });
    }
}