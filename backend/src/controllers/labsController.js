import { supabase } from '../config/supabaseClient.js';
import { getZipError } from '../utils/zipValidation.js';
import { logEvent, fromReq } from '../services/logService.js';
import {
    getPendingUpdate,
    isFlagTaken,
    queueUpdate,
    cancelUpdate,
    tryApplyUpdate,
} from '../services/labUpdateService.js';
import {
    MIN_BENEFITS,
    MAX_BENEFITS,
    COMPLETION_CRITERIA,
    getTitleError,
    getDescriptionError,
    getBenefitError,
    getBenefitsError,
    getFlagError,
    getScoreError,
    getInstructionsError,
    getTrophiesError,
    normalizeCriteria,
    COMPLETION_TROPHY,
} from '../utils/labValidation.js';

const PAGE_SIZE = 5;

// Cuenta usuarios DISTINTOS que completaron cada lab (iscompleted = true).
async function getCompletedUserCounts(labIds) {
    if (labIds.length === 0) return {};

    const { data, error } = await supabase
        .from('session')
        .select('labid, userid')
        .in('labid', labIds)
        .eq('iscompleted', true);

    if (error) throw error;

    const sets = {};
    labIds.forEach((id) => { sets[id] = new Set(); });
    data.forEach((row) => sets[row.labid]?.add(row.userid));

    const counts = {};
    labIds.forEach((id) => { counts[id] = sets[id].size; });
    return counts;
}

// Lógica compartida de listado. ownerId = null → todos los labs;
// ownerId = número → solo los labs creados por ese usuario.
// Sin búsqueda: top 5 más recientes (o todos con fetchAll).
// Con búsqueda: paginado, 5 por página, por título, descripción o autor (username).
async function queryLabs({ search, pageNumber, fetchAll, ownerId = null }) {
    const LAB_FIELDS = 'labid, title, description, score, userid, dateofcreation, dateofupdate, benefit(benefitid, description), users(username)';

    if (!search) {
        let query = supabase
            .from('lab')
            .select(LAB_FIELDS)
            .eq('isdeleted', false)
            .order('labid', { ascending: false });

        if (ownerId !== null) query = query.eq('userid', ownerId);
        if (!fetchAll) query = query.limit(PAGE_SIZE);

        const { data, error } = await query;
        if (error) throw error;

        const labIds = data.map((lab) => lab.labid);
        const completedCounts = await getCompletedUserCounts(labIds);
        const labs = data.map((lab) => ({
            ...lab,
            completedUserCount: completedCounts[lab.labid] ?? 0,
        }));

        return { labs, total: labs.length, page: 1, totalPages: 1 };
    }

    // Autores cuyo username coincide, para poder buscar "por autor" también.
    const { data: matchingUsers, error: userError } = await supabase
        .from('users')
        .select('userid')
        .ilike('username', `%${search}%`);

    if (userError) throw userError;

    const matchingUserIds = matchingUsers.map((u) => u.userid);

    const filters = [
        `title.ilike.%${search}%`,
        `description.ilike.%${search}%`,
    ];
    if (matchingUserIds.length > 0) {
        filters.push(`userid.in.(${matchingUserIds.join(',')})`);
    }

    const from = (pageNumber - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
        .from('lab')
        .select(LAB_FIELDS, { count: 'exact' })
        .eq('isdeleted', false)
        .or(filters.join(','));

    // .eq() se combina con AND con el .or() de arriba
    if (ownerId !== null) query = query.eq('userid', ownerId);

    const { data, error, count } = await query
        .order('labid', { ascending: false })
        .range(from, to);

    if (error) throw error;

    const labIds = data.map((lab) => lab.labid);
    const completedCounts = await getCompletedUserCounts(labIds);
    const labs = data.map((lab) => ({
        ...lab,
        completedUserCount: completedCounts[lab.labid] ?? 0,
    }));

    const total = count ?? labs.length;
    return { labs, total, page: pageNumber, totalPages: Math.ceil(total / PAGE_SIZE) };
}

// The search text ends up inside a PostgREST filter string, where "," and "()" start new
// conditions. Keep only letters, numbers, spaces and . : - so the text can never add conditions.
function cleanSearch(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/[^\p{L}\p{N} .:-]/gu, '').trim().slice(0, 100);
}

function readListParams(req) {
    return {
        search: cleanSearch(req.query.search),
        pageNumber: Math.max(1, parseInt(req.query.page, 10) || 1),
        fetchAll: req.query.all === 'true',
    };
}

// LIST PÚBLICO (LabsPage): todos los labs, sin login.
export const getAllLabs = async (req, res) => {
    try {
        const result = await queryLabs(readListParams(req));
        res.json(result);
    } catch (error) {
        console.error('Get labs error:', error);
        res.status(500).json({ message: 'Failed to fetch labs', error: error.message });
    }
};

// LIST DE GESTIÓN (Dashboard → Gestionar laboratorios). Protegido en la ruta.
// Admin (2): todos los labs. Instructor (1): solo los labs que él creó.
export const getManagedLabs = async (req, res) => {
    try {
        const { search, pageNumber } = readListParams(req);
        const ownerId = req.user.role === 2 ? null : req.user.userid;
        const result = await queryLabs({ search, pageNumber, fetchAll: false, ownerId });
        res.json(result);
    } catch (error) {
        console.error('Get managed labs error:', error);
        res.status(500).json({ message: 'Failed to fetch labs', error: error.message });
    }
};

async function checkLabAccess(req, res, labid, action) {
    if (!Number.isInteger(labid) || labid <= 0) {
        res.status(400).json({ message: 'ID de laboratorio inválido' });
        return null;
    }

    // un lab eliminado no se puede editar ni volver a eliminar
    const { data: lab, error } = await supabase
        .from('lab')
        .select('labid, userid, title')
        .eq('labid', labid)
        .eq('isdeleted', false)
        .maybeSingle();

    if (error) throw error;

    if (!lab) {
        res.status(404).json({ message: 'Laboratorio no encontrado' });
        return null;
    }

    if (req.user.role !== 2 && lab.userid !== req.user.userid) {
        logEvent({
            ...fromReq(req),
            action,
            facility: 'lab',
            event: 'LAB_ACCESS_DENIED',
            severity: 'warning',
            targetid: labid,
            description: `Intentó ${action === 'DELETE' ? 'eliminar' : 'editar'} el laboratorio #${labid} de otro usuario`,
        });
        res.status(403).json({ message: 'Solo puedes gestionar los laboratorios que creaste' });
        return null;
    }

    return lab;
}

// Borra la carpeta labs/{labid}/ completa del bucket (zip actual y cualquier sobrante).
// Best effort: si falla, solo se registra en consola y no frena la eliminación.
export async function removeLabFolder(labid) {
    const folder = `labs/${labid}`;

    const { data: files, error: listError } = await supabase.storage.from('labfiles').list(folder);
    if (listError) {
        console.error('Storage list failed:', folder, listError);
        return;
    }
    if (!files || files.length === 0) return;

    const paths = files.map((file) => `${folder}/${file.name}`);
    const { error } = await supabase.storage.from('labfiles').remove(paths);
    if (error) console.error('Storage folder remove failed:', folder, error);
}

// Best-effort cleanup when creating a lab fails halfway: undo whatever was already saved.
// Failures are only logged so the original error is the one the client sees.
async function rollbackLab(labId, filePath) {
    const steps = [
        () => supabase.storage.from('labfiles').remove([filePath]),
        () => supabase.from('benefit').delete().eq('labid', labId),
        () => supabase.from('trophy').delete().eq('labid', labId),
        () => supabase.from('lab').delete().eq('labid', labId),
    ];

    for (const step of steps) {
        const { error } = await step();
        if (error) console.error('Rollback step failed:', error);
    }
}

// CREATE (protegido: requireAuth + requireRole en la ruta)
export const createLab = async (req, res) => {
    let labId = null;
    let filePath = null;

    try {
        let benefits;
        try {
            benefits = JSON.parse(req.body.benefits || '[]');
        } catch {
            return res.status(400).json({ message: 'Formato de beneficios inválido' });
        }

        let trophies;
        try {
            trophies = JSON.parse(req.body.trophies || '[]');
        } catch {
            return res.status(400).json({ message: 'Formato de trofeos inválido' });
        }

        const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
        const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
        const flag = typeof req.body.flag === 'string' ? req.body.flag.trim() : '';
        // FormData sends everything as text; getScoreError checks it and Number() converts it below
        const score = typeof req.body.score === 'string' ? req.body.score.trim() : '';
        const instructions = typeof req.body.instructions === 'string'
            ? req.body.instructions.replace(/\r\n/g, '\n').trim()
            : '';
        if (Array.isArray(benefits)) {
            benefits = benefits.map((b) => (typeof b === 'string' ? b.trim() : b));
        }

        // Validate everything BEFORE writing anything
        const validationError =
            getTitleError(title) ||
            getDescriptionError(description) ||
            getBenefitsError(benefits) ||
            getScoreError(score) ||
            getInstructionsError(instructions) ||
            getTrophiesError(trophies) ||
            getFlagError(flag);

        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Falta el archivo zip del laboratorio' });
        }

        const zipProblem = await getZipError(req.file.buffer);
        if (zipProblem) {
            logEvent({
                ...fromReq(req),
                action: 'CREATE',
                facility: 'lab',
                event: 'LAB_UPLOAD_REJECTED',
                severity: 'warning',
                description: `Subida rechazada de «${title}»: ${zipProblem}`,
            });
            return res.status(400).json({ message: zipProblem, field: 'zipfile' });
        }

        // The frontend checks for duplicate titles too, but this check can't be skipped
        // Los labs eliminados no cuentan: su título queda libre
        const { data: sameTitle, error: titleCheckError } = await supabase
            .from('lab')
            .select('labid')
            .ilike('title', title)
            .eq('isdeleted', false)
            .limit(1);

        if (titleCheckError) throw titleCheckError;

        if (sameTitle.length > 0) {
            return res.status(409).json({ message: 'Ya existe un laboratorio con este título', field: 'title' });
        }

        // A flag that another lab has queued for its next update is taken as well
        if (await isFlagTaken(flag)) {
            return res.status(409).json({ message: 'Esa flag ya está en uso en otro laboratorio', field: 'flag' });
        }

        // dateofcreation is not sent: the database fills it in with its own clock (default now())
        const { data: labData, error: labError } = await supabase
            .from('lab')
            .insert([{ title, description, flag, instructions, score: Number(score), userid: req.user.userid }])
            .select();

        if (labError) {
            // 23505 = unique violation (the flag column is UNIQUE)
            if (labError.code === '23505') {
                return res.status(409).json({ message: 'Esa flag ya está en uso en otro laboratorio', field: 'flag' });
            }
            throw labError;
        }

        labId = labData[0].labid;
        filePath = `labs/${labId}/bundle.zip`;

        const { error: uploadError } = await supabase
            .storage
            .from('labfiles')
            .upload(filePath, req.file.buffer, { contentType: 'application/zip' });

        if (uploadError) throw uploadError;

        const { error: updateError } = await supabase
            .from('lab')
            .update({ zippath: filePath })
            .eq('labid', labId);

        if (updateError) throw updateError;

        const benefitRows = benefits.map((b) => ({ description: b, labid: labId }));
        const { error: benefitError } = await supabase.from('benefit').insert(benefitRows);

        if (benefitError) throw benefitError;

        // Every lab gets the automatic completion trophy, plus the ones the instructor defined
        const trophyRows = [COMPLETION_TROPHY, ...trophies].map((trophy) => ({
            type: trophy.type,
            name: trophy.name.trim(),
            description: trophy.description.trim(),
            criteriatype: trophy.criteriatype,
            criteria: normalizeCriteria(trophy.criteriatype, trophy.criteria),
            labid: labId,
        }));

        const { error: trophyError } = await supabase.from('trophy').insert(trophyRows);

        if (trophyError) throw trophyError;
        
        logEvent({
            ...fromReq(req),
            action: 'CREATE',
            facility: 'lab',
            event: 'LAB_CREATED',
            targetid: labId,
            description: `Creó el laboratorio «${title}» (#${labId})`,
        });
        res.json({ message: 'Lab created successfully', labId, filePath });
    } catch (error) {
        console.error('Create lab error:', error);
        if (labId !== null) await rollbackLab(labId, filePath);
        res.status(500).json({ message: 'Failed to create lab', error: error.message });
    }
};

// READ + CHECK
export const checkTitleDuplicate = async (req, res) => {
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';

    if (!title) {
        return res.status(400).json({ message: 'Title query param is required' });
    }

    // A title that breaks the rules can't exist. This also keeps % and _ (wildcards
    // in ilike) out of the query.
    if (getTitleError(title)) {
        return res.json({ exists: false });
    }

    const { data, error } = await supabase
        .from('lab')
        .select('labid')
        .ilike('title', title)
        .eq('isdeleted', false)
        .limit(1);

    if (error) {
        console.error('Duplicate check error:', error);
        return res.status(500).json({ message: 'Failed to check title', error: error.message });
    }

    res.json({ exists: data.length > 0 });
};

// Everything the edit screen needs in one call: the fields that can be edited, the trophies (with how
// many students earned each), and the pending zip + flag update if there is one.
// The flag is only sent here because checkLabAccess already limited this to the author and admins.
export const getLabForEdit = async (req, res) => {
    const labid = Number(req.params.labid);

    try {
        if (!(await checkLabAccess(req, res, labid, 'UPDATE'))) return;

        // The lab may be free by now: this is one of the moments a pending update gets applied
        let pending = await getPendingUpdate(labid);
        let openSessions = 0;

        if (pending) {
            const result = await tryApplyUpdate(labid, fromReq(req)).catch((err) => {
                console.error('Apply pending update error:', err);
                return null;
            });

            if (result?.applied) pending = null;
            else openSessions = result?.openSessions ?? 0;
        }

        const { data: lab, error: labError } = await supabase
            .from('lab')
            .select('labid, title, description, score, instructions, flag, benefit(benefitid, description)')
            .eq('labid', labid)
            .single();

        if (labError) throw labError;

        const { data: trophies, error: trophyError } = await supabase
            .from('trophy')
            .select('trophyid, type, name, description, criteriatype, criteria')
            .eq('labid', labid)
            .neq('criteriatype', COMPLETION_CRITERIA) // the automatic trophy is not editable, so it is not sent
            .order('trophyid', { ascending: true });

        if (trophyError) throw trophyError;

        const earnedCounts = await getEarnedCounts(trophies.map((trophy) => trophy.trophyid));

        res.json({
            lab: {
                ...lab,
                benefit: [...(lab.benefit ?? [])].sort((a, b) => a.benefitid - b.benefitid),
                trophies: trophies.map((trophy) => ({ ...trophy, earnedCount: earnedCounts[trophy.trophyid] ?? 0 })),
                pendingUpdate: pending && {
                    dateofcreation: pending.dateofcreation,
                    lasterror: pending.lasterror,
                    openSessions,
                },
            },
        });
    } catch (error) {
        console.error('Get lab for edit error:', error);
        res.status(500).json({ message: 'Failed to fetch lab', error: error.message });
    }
};

// How many students earned each trophy: { trophyid: count }
async function getEarnedCounts(trophyIds) {
    if (trophyIds.length === 0) return {};

    const { data, error } = await supabase
        .from('trophyuser')
        .select('trophyid')
        .in('trophyid', trophyIds);

    if (error) throw error;

    const counts = {};
    data.forEach((row) => { counts[row.trophyid] = (counts[row.trophyid] ?? 0) + 1; });
    return counts;
}

const toTrophyFields = (trophy) => ({
    type: trophy.type,
    name: typeof trophy.name === 'string' ? trophy.name.trim() : trophy.name,
    description: typeof trophy.description === 'string' ? trophy.description.trim() : trophy.description,
    criteriatype: trophy.criteriatype,
    criteria: trophy.criteria,
});

// Works out what the trophy part of an edit would leave in the database, and checks it.
// Returns { error } or { removeIds, updates: [{ trophyid, fields }], adds: [fields], finalList }.
// Nothing is written here: the caller writes only after EVERYTHING in the request has been checked.
async function planTrophyChanges(labid, changes) {
    const { add = [], update = [], removeIds = [] } = changes;

    if (!Array.isArray(add) || !Array.isArray(update) || !Array.isArray(removeIds)) {
        return { error: 'Formato de trofeos inválido' };
    }

    const { data: current, error: currentError } = await supabase
        .from('trophy')
        .select('trophyid, type, name, description, criteriatype, criteria')
        .eq('labid', labid)
        .neq('criteriatype', COMPLETION_CRITERIA);

    if (currentError) throw currentError;

    const earnedCounts = await getEarnedCounts(current.map((trophy) => trophy.trophyid));
    const byId = new Map(current.map((trophy) => [trophy.trophyid, trophy]));

    const removeSet = new Set();
    for (const raw of removeIds) {
        const trophyid = Number(raw);
        const trophy = byId.get(trophyid);
        if (!trophy) return { error: 'Uno de los trofeos a eliminar no pertenece a este laboratorio' };

        const earned = earnedCounts[trophyid] ?? 0;
        if (earned > 0) {
            return { error: `El trofeo «${trophy.name}» ya fue obtenido por ${earned} usuario(s) y no se puede eliminar` };
        }
        removeSet.add(trophyid);
    }

    const updates = [];
    for (const raw of update) {
        const trophyid = Number(raw?.trophyid);
        const trophy = byId.get(trophyid);
        if (!trophy || removeSet.has(trophyid)) {
            return { error: 'Uno de los trofeos a editar no pertenece a este laboratorio' };
        }

        const fields = toTrophyFields(raw);

        // Once somebody earned a trophy, its meaning is frozen: only the name and description can change
        if ((earnedCounts[trophyid] ?? 0) > 0) {
            const sameCriteria =
                fields.criteriatype === trophy.criteriatype &&
                normalizeCriteria(fields.criteriatype, fields.criteria) === normalizeCriteria(trophy.criteriatype, trophy.criteria);

            if (fields.type !== trophy.type || !sameCriteria) {
                return { error: `El trofeo «${trophy.name}» ya fue obtenido: solo puedes cambiar su nombre y descripción` };
            }
        }

        updates.push({ trophyid, fields });
    }

    const adds = add.map(toTrophyFields);

    // What the lab would have after the change: validated like a brand-new lab's trophies
    // (caps per type, duplicated criteria...)
    const updatesById = new Map(updates.map((item) => [item.trophyid, item.fields]));
    const finalList = [
        ...current
            .filter((trophy) => !removeSet.has(trophy.trophyid))
            .map((trophy) => updatesById.get(trophy.trophyid) ?? toTrophyFields(trophy)),
        ...adds,
    ];

    const problem = getTrophiesError(finalList);
    if (problem) return { error: problem };

    return { removeIds: [...removeSet], updates, adds, finalList };
}

// UPDATE (protegido: requireAuth + requireRole en la ruta)
// Solo cambia lo que llega en la petición. Se valida TODO antes de escribir nada.
// Editable aquí: título, descripción, instrucciones, beneficios y trofeos.
// NO editable aquí: el puntaje (de él salen los XP) ni la flag y el zip (van juntos, ver requestFileUpdate).
export const updateLab = async (req, res) => {
    const labid = Number(req.params.labid);
    const body = req.body ?? {};

    try {
        const lab = await checkLabAccess(req, res, labid, 'UPDATE');
        if (!lab) return;

        if (body.score !== undefined) {
            return res.status(400).json({ message: 'El puntaje no se puede modificar después de crear el laboratorio' });
        }
        if (body.flag !== undefined || body.zippath !== undefined) {
            return res.status(400).json({ message: 'La flag y el archivo zip se cambian juntos, con una actualización programada' });
        }

        const addBenefits = body.addBenefits ?? [];
        const removeBenefitIds = body.removeBenefitIds ?? [];

        if (!Array.isArray(addBenefits) || !Array.isArray(removeBenefitIds)) {
            return res.status(400).json({ message: 'Formato de beneficios inválido' });
        }

        const cleanBenefits = addBenefits.map((benefit) => (typeof benefit === 'string' ? benefit.trim() : benefit));
        const benefitProblem = cleanBenefits.map(getBenefitError).find(Boolean);
        if (benefitProblem) {
            return res.status(400).json({ message: benefitProblem, field: 'benefits' });
        }

        const updates = {};

        if (body.title !== undefined) {
            const title = String(body.title).trim();
            const titleProblem = getTitleError(title);
            if (titleProblem) return res.status(400).json({ message: titleProblem, field: 'title' });

            const { data: sameTitle, error: titleCheckError } = await supabase
                .from('lab')
                .select('labid')
                .ilike('title', title)
                .neq('labid', labid)
                .eq('isdeleted', false)
                .limit(1);

            if (titleCheckError) throw titleCheckError;

            if (sameTitle.length > 0) {
                return res.status(409).json({ message: 'Ya existe un laboratorio con este título', field: 'title' });
            }

            updates.title = title;
        }

        if (body.description !== undefined) {
            const description = String(body.description).trim();
            const descriptionProblem = getDescriptionError(description);
            if (descriptionProblem) return res.status(400).json({ message: descriptionProblem, field: 'description' });

            updates.description = description;
        }

        if (body.instructions !== undefined) {
            const instructions = String(body.instructions).replace(/\r\n/g, '\n').trim();
            const instructionsProblem = getInstructionsError(instructions);
            if (instructionsProblem) return res.status(400).json({ message: instructionsProblem, field: 'instructions' });

            updates.instructions = instructions;
        }

        // Benefits: the lab must still end up with the allowed amount (only checked when they change)
        const benefitsChanged = cleanBenefits.length > 0 || removeBenefitIds.length > 0;
        let removableBenefitIds = [];

        if (benefitsChanged) {
            const { data: currentBenefits, error: benefitsError } = await supabase
                .from('benefit')
                .select('benefitid')
                .eq('labid', labid);

            if (benefitsError) throw benefitsError;

            const wanted = new Set(removeBenefitIds.map(Number));
            removableBenefitIds = currentBenefits
                .map((benefit) => benefit.benefitid)
                .filter((benefitid) => wanted.has(benefitid)); // solo beneficios de ESTE lab

            const finalCount = currentBenefits.length - removableBenefitIds.length + cleanBenefits.length;

            if (finalCount < MIN_BENEFITS) {
                return res.status(400).json({ message: `Debes indicar al menos ${MIN_BENEFITS} beneficios`, field: 'benefits' });
            }
            if (finalCount > MAX_BENEFITS) {
                return res.status(400).json({ message: `Máximo ${MAX_BENEFITS} beneficios`, field: 'benefits' });
            }
        }

        let trophyPlan = null;
        const trophyChanges = body.trophyChanges;

        if (trophyChanges !== undefined) {
            if (!trophyChanges || typeof trophyChanges !== 'object' || Array.isArray(trophyChanges)) {
                return res.status(400).json({ message: 'Formato de trofeos inválido', field: 'trophies' });
            }

            trophyPlan = await planTrophyChanges(labid, trophyChanges);
            if (trophyPlan.error) {
                return res.status(400).json({ message: trophyPlan.error, field: 'trophies' });
            }
        }

        // ---- Everything is valid: now it is written ----

        if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
                .from('lab')
                .update(updates)
                .eq('labid', labid);

            if (updateError) throw updateError;
        }

        if (removableBenefitIds.length > 0) {
            const { error: removeError } = await supabase
                .from('benefit')
                .delete()
                .in('benefitid', removableBenefitIds)
                .eq('labid', labid);

            if (removeError) throw removeError;
        }

        if (cleanBenefits.length > 0) {
            const benefitRows = cleanBenefits.map((description) => ({ description, labid }));
            const { error: addError } = await supabase.from('benefit').insert(benefitRows);
            if (addError) throw addError;
        }

        if (trophyPlan) {
            if (trophyPlan.removeIds.length > 0) {
                const { error: removeError } = await supabase
                    .from('trophy')
                    .delete()
                    .in('trophyid', trophyPlan.removeIds)
                    .eq('labid', labid);

                if (removeError) throw removeError;
            }

            for (const { trophyid, fields } of trophyPlan.updates) {
                const { error: trophyUpdateError } = await supabase
                    .from('trophy')
                    .update({
                        type: fields.type,
                        name: fields.name,
                        description: fields.description,
                        criteriatype: fields.criteriatype,
                        criteria: normalizeCriteria(fields.criteriatype, fields.criteria),
                    })
                    .eq('trophyid', trophyid)
                    .eq('labid', labid);

                if (trophyUpdateError) throw trophyUpdateError;
            }

            if (trophyPlan.adds.length > 0) {
                const rows = trophyPlan.adds.map((fields) => ({
                    ...fields,
                    criteria: normalizeCriteria(fields.criteriatype, fields.criteria),
                    labid,
                }));
                const { error: trophyInsertError } = await supabase.from('trophy').insert(rows);
                if (trophyInsertError) throw trophyInsertError;
            }
        }

        const fieldNames = { title: 'título', description: 'descripción', instructions: 'instrucciones' };
        const changes = [
            ...Object.keys(updates).map((field) => fieldNames[field]),
            cleanBenefits.length > 0 && `+${cleanBenefits.length} beneficio(s)`,
            removableBenefitIds.length > 0 && `-${removableBenefitIds.length} beneficio(s)`,
            trophyPlan && trophyPlan.adds.length > 0 && `+${trophyPlan.adds.length} trofeo(s)`,
            trophyPlan && trophyPlan.updates.length > 0 && `${trophyPlan.updates.length} trofeo(s) editado(s)`,
            trophyPlan && trophyPlan.removeIds.length > 0 && `-${trophyPlan.removeIds.length} trofeo(s)`,
        ].filter(Boolean);

        // fecha de actualizacion
        if (changes.length > 0) {
            const { error: dateError } = await supabase
                .from('lab')
                .update({ dateofupdate: new Date().toISOString() })
                .eq('labid', labid);

            if (dateError) throw dateError;
        }

        logEvent({
            ...fromReq(req),
            action: 'UPDATE',
            facility: 'lab',
            event: 'LAB_UPDATED',
            targetid: labid,
            description: `Editó el laboratorio #${labid}: ${changes.join(', ') || 'sin cambios'}`,
        });

        res.json({ message: 'Lab updated successfully' });
    } catch (error) {
        console.error('Update lab error:', error);
        res.status(500).json({ message: 'Failed to update lab', error: error.message });
    }
};

// REQUEST A NEW ZIP + FLAG (protegido: requireAuth + requireRole en la ruta)
// They always travel together: the flag must be the one hidden inside the new zip.
// The pair is validated like in a new lab and queued; it is applied when the lab has no open session.
export const requestFileUpdate = async (req, res) => {
    const labid = Number(req.params.labid);

    try {
        const lab = await checkLabAccess(req, res, labid, 'UPDATE');
        if (!lab) return;

        const flag = typeof req.body?.flag === 'string' ? req.body.flag.trim() : '';
        const flagProblem = getFlagError(flag);
        if (flagProblem) return res.status(400).json({ message: flagProblem, field: 'flag' });

        if (!req.file) {
            return res.status(400).json({ message: 'Falta el archivo zip del laboratorio', field: 'zipfile' });
        }

        const zipProblem = await getZipError(req.file.buffer);
        if (zipProblem) {
            logEvent({
                ...fromReq(req),
                action: 'UPDATE',
                facility: 'lab',
                event: 'LAB_UPLOAD_REJECTED',
                severity: 'warning',
                targetid: labid,
                description: `Subida rechazada para actualizar «${lab.title}»: ${zipProblem}`,
            });
            return res.status(400).json({ message: zipProblem, field: 'zipfile' });
        }

        // The same flag as the lab already has is fine (only the zip changes)
        if (await isFlagTaken(flag, labid)) {
            return res.status(409).json({ message: 'Esa flag ya está en uso en otro laboratorio', field: 'flag' });
        }

        try {
            await queueUpdate({ labid, userid: req.user.userid, flag, zipBuffer: req.file.buffer });
        } catch (error) {
            // 23505 = another lab queued this flag a moment ago
            if (error.code === '23505') {
                return res.status(409).json({ message: 'Esa flag ya está en uso en otro laboratorio', field: 'flag' });
            }
            throw error;
        }

        logEvent({
            ...fromReq(req),
            action: 'UPDATE',
            facility: 'lab',
            event: 'LAB_UPDATE_QUEUED',
            targetid: labid,
            description: `Programó una actualización de archivo y flag del laboratorio «${lab.title}» (#${labid})`,
        });

        // If the lab is free right now it is applied on the spot; otherwise it waits
        const result = await tryApplyUpdate(labid, fromReq(req)).catch((error) => {
            console.error('Apply pending update error:', error);
            return { applied: false };
        });

        res.json({
            message: result.applied ? 'Archivo y flag actualizados' : 'Actualización programada',
            applied: !!result.applied,
            openSessions: result.openSessions ?? 0,
        });
    } catch (error) {
        console.error('Request file update error:', error);
        res.status(500).json({ message: 'Failed to queue the update', error: error.message });
    }
};

// CANCEL THE PENDING UPDATE (protegido: requireAuth + requireRole en la ruta)
export const cancelFileUpdate = async (req, res) => {
    const labid = Number(req.params.labid);

    try {
        const lab = await checkLabAccess(req, res, labid, 'UPDATE');
        if (!lab) return;

        const cancelled = await cancelUpdate(labid);
        if (!cancelled) {
            return res.status(404).json({ message: 'Este laboratorio no tiene una actualización pendiente' });
        }

        logEvent({
            ...fromReq(req),
            action: 'UPDATE',
            facility: 'lab',
            event: 'LAB_UPDATE_CANCELLED',
            targetid: labid,
            description: `Canceló la actualización pendiente del laboratorio «${lab.title}» (#${labid})`,
        });

        res.json({ message: 'Update cancelled' });
    } catch (error) {
        console.error('Cancel file update error:', error);
        res.status(500).json({ message: 'Failed to cancel the update', error: error.message });
    }
};

// APPLY NOW (solo admin: se comprueba en la ruta). Cierra las sesiones abiertas del lab, sin XP ni trofeos.
export const forceApplyFileUpdate = async (req, res) => {
    const labid = Number(req.params.labid);

    try {
        const lab = await checkLabAccess(req, res, labid, 'UPDATE');
        if (!lab) return;

        if (!(await getPendingUpdate(labid))) {
            return res.status(404).json({ message: 'Este laboratorio no tiene una actualización pendiente' });
        }

        const result = await tryApplyUpdate(labid, { ...fromReq(req), force: true });

        if (!result.applied) {
            return res.status(409).json({
                message: result.reason === 'busy'
                    ? 'La actualización ya se está aplicando, espera unos segundos'
                    : 'No se pudo aplicar la actualización ahora. Se reintentará automáticamente.',
            });
        }

        res.json({ message: 'Update applied', applied: true });
    } catch (error) {
        console.error('Force apply update error:', error);
        res.status(500).json({ message: 'Failed to apply the update', error: error.message });
    }
};

// DELETE (protegido: requireAuth + requireRole en la ruta)
export const deleteLab = async (req, res) => {
    const labid = Number(req.params.labid);

    try {
        const lab = await checkLabAccess(req, res, labid, 'DELETE');
        if (!lab) return;

        // el lab se marca como eliminado pero se conserva todo lo asociado
        const { error: labDeleteError } = await supabase
            .from('lab')
            .update({ isdeleted: true, zippath: null })
            .eq('labid', labid);

        if (labDeleteError) throw labDeleteError;

        // Its queued zip + flag (if any) is dropped too
        await cancelUpdate(labid).catch((err) => console.error('Cancel pending update after delete failed:', err));

        // un lab eliminado no se puede iniciar: su zip ya no hace falta
        await removeLabFolder(labid);

        logEvent({
            ...fromReq(req),
            action: 'DELETE',
            facility: 'lab',
            event: 'LAB_DELETED',
            targetid: labid,
            description: `Eliminó el laboratorio «${lab.title}» (#${labid})${
                lab.userid !== req.user.userid ? ` creado por el usuario #${lab.userid}` : ''
            }`,
        });

        res.json({ message: 'Lab deleted successfully' });
    } catch (error) {
        console.error('Delete lab error:', error);
        res.status(500).json({ message: 'Failed to delete lab', error: error.message });
    }
};
