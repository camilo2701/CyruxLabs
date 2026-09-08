import { supabase } from '../config/supabaseClient.js';

// TODO: reemplazar por el userid real (del token) cuando labs también use auth.
const TEST_USER_ID = 2;

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

        if (!search) {
            const { data, error } = await supabase
                .from('lab')
                .select('labid, title, description, userid, benefit(benefitid, description), users(username)')
                .order('labid', { ascending: false })
                .limit(PAGE_SIZE);

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

// CREATE
export const createLab = async (req, res) => {
    const { title, description } = req.body;
    const benefits = JSON.parse(req.body.benefits || '[]');

    const { data: labData, error: labError } = await supabase
        .from('lab')
        .insert([{ title, description, userid: TEST_USER_ID }])
        .select();

    if (labError) {
        console.error('Lab insert error:', labError);
        return res.status(500).json({ message: 'Failed to create lab', error: labError.message });
    }

    const labId = labData[0].labid;
    const filePath = `labs/${labId}/bundle.zip`;

    const { error: uploadError } = await supabase
        .storage
        .from('labfiles')
        .upload(filePath, req.file.buffer, { contentType: 'application/zip' });

    if (uploadError) {
        console.error('Upload error:', uploadError);
        return res.status(500).json({ message: 'Lab created but file upload failed', labId, error: uploadError.message });
    }

    const { error: updateError } = await supabase
        .from('lab')
        .update({ zippath: filePath })
        .eq('labid', labId);

    if (updateError) console.error('Update error:', updateError);

    if (benefits.length > 0) {
        const benefitRows = benefits.map((b) => ({ description: b, labid: labId }));
        const { error: benefitError } = await supabase.from('benefit').insert(benefitRows);
        if (benefitError) console.error('Benefit insert error:', benefitError);
    }

    res.json({ message: 'Lab created successfully', labId, filePath });
};

// READ + CHECK
export const checkTitleDuplicate = async (req, res) => {
    const { title } = req.query;

    if (!title) {
        return res.status(400).json({ message: 'Title query param is required' });
    }

    const { data, error } = await supabase
        .from('lab')
        .select('labid')
        .ilike('title', title)
        .maybeSingle();

    if (error) {
        console.error('Duplicate check error:', error);
        return res.status(500).json({ message: 'Failed to check title', error: error.message });
    }

    res.json({ exists: !!data });
};

// UPDATE (protegido: requireAuth + requireRole en la ruta)
// Guarda todo junto: título/descripción, más beneficios a agregar/quitar.
export const updateLab = async (req, res) => {
    const { labid } = req.params;
    const { title, description, addBenefits = [], removeBenefitIds = [] } = req.body;

    try {
        const updates = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;

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
            const benefitRows = addBenefits.map((description) => ({ description, labid }));
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