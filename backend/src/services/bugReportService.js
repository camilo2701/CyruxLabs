import { supabase } from '../config/supabaseClient.js';

export async function createBugReport({ title, description, userid, labid }) {
    const today = new Date().toISOString().split('T')[0];

    // Limit: one report per user, per lab, per day
    const { count, error: countError } = await supabase
        .from('bugreport')
        .select('bugreportid', { count: 'exact', head: true })
        .eq('userid', userid)
        .eq('labid', labid)
        .eq('dateofcreation', today);

    if (countError) throw countError;

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
export async function getPendingBugCounts(labIds, ownerId = null) {
    if (labIds.length === 0) return {};

    // Instructor: solo cuenta bugs de los labs que él creó.
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

    const counts = {};
    data.forEach((row) => {
        counts[row.labid] = (counts[row.labid] || 0) + 1;
    });
    return counts;
}


function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}

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

export async function getReportsForLab(labid, reqUser) {
    if (!Number.isInteger(labid) || labid <= 0) throw httpError(400, 'ID de laboratorio inválido');
    await assertCanReviewLab(labid, reqUser);

    const { data, error } = await supabase
        .from('bugreport')
        .select('bugreportid, title, description, dateofcreation, status, userid, users(username)')
        .eq('labid', labid)
        .order('dateofcreation', { ascending: false })
        .order('bugreportid', { ascending: false });

    if (error) throw error;

    return data.map(({ users, ...report }) => ({
        ...report,
        username: users?.username ?? 'Usuario eliminado',
    }));
}

// status: 0 = pendiente, 1 = resuelto/revisado
export async function updateReportStatus(bugreportid, status, reqUser) {
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

    // un bug que pasa a Resuelto cuenta como actualización del lab (volver a Pendiente no)
    if (report.status === 0 && status === 1) {
        const { error: dateError } = await supabase
            .from('lab')
            .update({ dateofupdate: new Date().toISOString() })
            .eq('labid', report.labid);

        if (dateError) throw dateError;
    }

    return { bugreportid, status };
}
