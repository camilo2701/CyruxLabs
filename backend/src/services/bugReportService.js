// Este archivo se encarga de gestionar los reportes de errores (bugs) de los laboratorios:
// crearlos con límite diario, contar los pendientes y permitir a los instructores revisarlos.
import { supabase } from '../config/supabaseClient.js';

// Esta función se encarga de crear un reporte de bug para un lab, limitando a uno por
// usuario, laboratorio y día.
export async function createBugReport({ title, description, userid, labid }) {
    const today = new Date().toISOString().split('T')[0];

    // Validación del límite: cuenta cuántos reportes ya hizo este usuario en este lab hoy.
    // Limit: one report per user, per lab, per day
    const { count, error: countError } = await supabase
        .from('bugreport')
        .select('bugreportid', { count: 'exact', head: true })
        .eq('userid', userid)
        .eq('labid', labid)
        .eq('dateofcreation', today);

    if (countError) throw countError;

    // Si ya existe uno hoy, se rechaza con 429 (demasiadas peticiones).
    if (count > 0) {
        const err = new Error('Ya reportaste un problema en este laboratorio hoy');
        err.status = 429;
        throw err;
    }

    const { data, error } = await supabase
        .from('bugreport')
        .insert([{ title, description, userid, labid, dateofcreation: today }])
        .select('bugreportid')
        .single();

    if (error) throw error;

    return { bugreportid: data.bugreportid };
}

// bugs pendientes (status 0) de cada lab
// Esta función se encarga de contar los bugs pendientes de un conjunto de labs, devolviendo
// un objeto { labid: cantidad }.
export async function getPendingBugCounts(labIds, ownerId = null) {
    if (labIds.length === 0) return {};

    // Instructor: solo cuenta bugs de los labs que él creó.
    // Si se pasa ownerId, se filtran los labs para quedarse solo con los que creó ese instructor.
    if (ownerId !== null) {
        const { data: ownLabs, error: ownError } = await supabase
            .from('lab')
            .select('labid')
            .in('labid', labIds)
            .eq('userid', ownerId);

        if (ownError) throw ownError;
        labIds = ownLabs.map((lab) => lab.labid);
        if (labIds.length === 0) return {};
    }

    const { data, error } = await supabase
        .from('bugreport')
        .select('labid')
        .in('labid', labIds)
        .eq('status', 0);

    if (error) throw error;

    // Agrupa las filas contando cuántos bugs pendientes tiene cada lab.
    const counts = {};
    data.forEach((row) => {
        counts[row.labid] = (counts[row.labid] || 0) + 1;
    });
    return counts;
}


// Esta función se encarga de crear un objeto Error con un código de estado HTTP asociado.
function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}

// Esta función se encarga de verificar que el usuario puede revisar los reportes de un lab:
// debe ser admin (rol 2) o el dueño del laboratorio.
async function assertCanReviewLab(labid, reqUser) {
    const { data: lab, error } = await supabase
        .from('lab')
        .select('labid, userid')
        .eq('labid', labid)
        .maybeSingle();

    if (error) throw error;
    if (!lab) throw httpError(404, 'Laboratorio no encontrado');
    if (reqUser.role !== 2 && lab.userid !== reqUser.userid) {
        throw httpError(403, 'Solo puedes revisar los reportes de tus laboratorios');
    }
}

// Esta función se encarga de listar los reportes de un lab (previa validación de permisos),
// añadiendo el nombre de usuario de quien reportó cada uno.
export async function getReportsForLab(labid, reqUser) {
    // Validación: el id debe ser un entero positivo, y el usuario debe tener permiso.
    if (!Number.isInteger(labid) || labid <= 0) throw httpError(400, 'ID de laboratorio inválido');
    await assertCanReviewLab(labid, reqUser);

    const { data, error } = await supabase
        .from('bugreport')
        .select('bugreportid, title, description, dateofcreation, status, userid, users(username)')
        .eq('labid', labid)
        .order('dateofcreation', { ascending: false })
        .order('bugreportid', { ascending: false });

    if (error) throw error;

    // Aplana la relación con users dejando solo el username (o un marcador si fue eliminado).
    return data.map(({ users, ...report }) => ({
        ...report,
        username: users?.username ?? 'Usuario eliminado',
    }));
}

// status: 0 = pendiente, 1 = resuelto/revisado
// Esta función se encarga de cambiar el estado de un reporte (pendiente/resuelto) tras validar
// permisos, y marca el lab como actualizado cuando un bug pasa a resuelto.
export async function updateReportStatus(bugreportid, status, reqUser) {
    // Validación de los parámetros de entrada.
    if (!Number.isInteger(bugreportid) || bugreportid <= 0) throw httpError(400, 'ID de reporte inválido');
    if (status !== 0 && status !== 1) throw httpError(400, 'Estado inválido');

    const { data: report, error: fetchError } = await supabase
        .from('bugreport')
        .select('bugreportid, labid, status')
        .eq('bugreportid', bugreportid)
        .maybeSingle();

    if (fetchError) throw fetchError;
    if (!report) throw httpError(404, 'Reporte no encontrado');

    await assertCanReviewLab(report.labid, reqUser);

    const { error: updateError } = await supabase
        .from('bugreport')
        .update({ status })
        .eq('bugreportid', bugreportid);

    if (updateError) throw updateError;

    // un bug que pasa a Resuelto cuenta como actualizacion del lab
    // Solo al pasar de pendiente (0) a resuelto (1) se actualiza la fecha de actualización del lab.
    if (report.status === 0 && status === 1) {
        const { error: dateError } = await supabase
            .from('lab')
            .update({ dateofupdate: new Date().toISOString() })
            .eq('labid', report.labid);

        if (dateError) throw dateError;
    }

    return { bugreportid, status };
}
