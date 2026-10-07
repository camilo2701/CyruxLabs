import { supabase } from '../config/supabaseClient.js';
import {
    getTitleError,
    getDescriptionError,
    getBenefitError,
    getBenefitsError,
    getFlagError,
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

// LIST (sin búsqueda: top 5 más recientes) / SEARCH (paginado, 5 por página)
// Busca coincidencias en título, descripción o autor (username).
export const getAllLabs = async (req, res) => {
    try {
        const search = (req.query.search || '').trim().slice(0, 100);
        const pageNumber = Math.max(1, parseInt(req.query.page, 10) || 1);
        const fetchAll = req.query.all === 'true';

        if (!search) {
            let query = supabase
                .from('lab')
                .select('labid, title, description, userid, benefit(benefitid, description), users(username)')
                .order('labid', { ascending: false });

            if (!fetchAll) {
                query = query.limit(PAGE_SIZE);
            }

            const { data, error } = await query;

            if (error) throw error;

            const labIds = data.map((lab) => lab.labid);
            const completedCounts = await getCompletedUserCounts(labIds);
            const labs = data.map((lab) => ({
                ...lab,
                completedUserCount: completedCounts[lab.labid] ?? 0,
            }));

            return res.json({ labs, total: labs.length, page: 1, totalPages: 1 });
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

        const { data, error, count } = await supabase
            .from('lab')
            .select(
                'labid, title, description, userid, benefit(benefitid, description), users(username)',
                { count: 'exact' }
            )
            .or(filters.join(','))
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
        res.json({ labs, total, page: pageNumber, totalPages: Math.ceil(total / PAGE_SIZE) });
    } catch (error) {
        console.error('Get labs error:', error);
        res.status(500).json({ message: 'Failed to fetch labs', error: error.message });
    }
};

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
            getInstructionsError(instructions) ||
            getTrophiesError(trophies) ||
            getFlagError(flag);

        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Falta el archivo zip del laboratorio' });
        }

        // The frontend checks for duplicate titles too, but this check can't be skipped
        const { data: sameTitle, error: titleCheckError } = await supabase
            .from('lab')
            .select('labid')
            .ilike('title', title)
            .limit(1);

        if (titleCheckError) throw titleCheckError;

        if (sameTitle.length > 0) {
            return res.status(409).json({ message: 'Ya existe un laboratorio con este título', field: 'title' });
        }

        const { data: labData, error: labError } = await supabase
            .from('lab')
            .insert([{ title, description, flag, instructions, userid: req.user.userid }])
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
        .limit(1);

    if (error) {
        console.error('Duplicate check error:', error);
        return res.status(500).json({ message: 'Failed to check title', error: error.message });
    }

    res.json({ exists: data.length > 0 });
};

// UPDATE (protegido: requireAuth + requireRole en la ruta)
// Guarda todo junto: título/descripción, más beneficios a agregar/quitar.
export const updateLab = async (req, res) => {
    const { labid } = req.params;
    const { addBenefits = [], removeBenefitIds = [] } = req.body;

    try {
        if (!Array.isArray(addBenefits) || !Array.isArray(removeBenefitIds)) {
            return res.status(400).json({ message: 'Formato de beneficios inválido' });
        }

        const benefitProblem = addBenefits.map(getBenefitError).find(Boolean);
        if (benefitProblem) {
            return res.status(400).json({ message: benefitProblem });
        }

        const updates = {};

        if (req.body.title !== undefined) {
            const title = String(req.body.title).trim();
            const titleProblem = getTitleError(title);
            if (titleProblem) return res.status(400).json({ message: titleProblem });

            const { data: sameTitle, error: titleCheckError } = await supabase
                .from('lab')
                .select('labid')
                .ilike('title', title)
                .neq('labid', labid)
                .limit(1);

            if (titleCheckError) throw titleCheckError;

            if (sameTitle.length > 0) {
                return res.status(409).json({ message: 'Ya existe un laboratorio con este título', field: 'title' });
            }

            updates.title = title;
        }

        if (req.body.description !== undefined) {
            const description = String(req.body.description).trim();
            const descriptionProblem = getDescriptionError(description);
            if (descriptionProblem) return res.status(400).json({ message: descriptionProblem });

            updates.description = description;
        }

        if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
                .from('lab')
                .update(updates)
                .eq('labid', labid);

            if (updateError) throw updateError;
        }

        if (removeBenefitIds.length > 0) {
            const { error: removeError } = await supabase
                .from('benefit')
                .delete()
                .in('benefitid', removeBenefitIds);

            if (removeError) throw removeError;
        }

        if (addBenefits.length > 0) {
            const benefitRows = addBenefits.map((description) => ({ description: description.trim(), labid }));
            const { error: addError } = await supabase.from('benefit').insert(benefitRows);
            if (addError) throw addError;
        }

        res.json({ message: 'Lab updated successfully' });
    } catch (error) {
        console.error('Update lab error:', error);
        res.status(500).json({ message: 'Failed to update lab', error: error.message });
    }
};

// DELETE (protegido: requireAuth + requireRole en la ruta)
export const deleteLab = async (req, res) => {
    const { labid } = req.params;

    try {
        // trophyuser -> trophy -> lab: each table has a foreign key to the next, so delete in this order
        const { data: labTrophies, error: trophyReadError } = await supabase
            .from('trophy')
            .select('trophyid')
            .eq('labid', labid);

        if (trophyReadError) throw trophyReadError;

        const trophyIds = labTrophies.map((t) => t.trophyid);

        if (trophyIds.length > 0) {
            const { error: unlockDeleteError } = await supabase
                .from('trophyuser')
                .delete()
                .in('trophyid', trophyIds);

            if (unlockDeleteError) throw unlockDeleteError;

            const { error: trophyDeleteError } = await supabase
                .from('trophy')
                .delete()
                .eq('labid', labid);

            if (trophyDeleteError) throw trophyDeleteError;
        }

        // bugreport tiene FK a lab: hay que borrarlos antes o el delete del lab falla
        const { error: bugReportDeleteError } = await supabase
            .from('bugreport')
            .delete()
            .eq('labid', labid);

        if (bugReportDeleteError) throw bugReportDeleteError;

        const { error: sessionDeleteError } = await supabase
            .from('session')
            .delete()
            .eq('labid', labid);

        if (sessionDeleteError) throw sessionDeleteError;

        const { error: benefitDeleteError } = await supabase
            .from('benefit')
            .delete()
            .eq('labid', labid);

        if (benefitDeleteError) throw benefitDeleteError;

        const { error: labDeleteError } = await supabase
            .from('lab')
            .delete()
            .eq('labid', labid);

        if (labDeleteError) throw labDeleteError;

        res.json({ message: 'Lab deleted successfully' });
    } catch (error) {
        console.error('Delete lab error:', error);
        res.status(500).json({ message: 'Failed to delete lab', error: error.message });
    }
};