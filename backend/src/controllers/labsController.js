import { supabase } from '../config/supabaseClient.js';

// TODO: reemplazar por el userid real (del token) cuando labs también use auth.
const TEST_USER_ID = 2;

// SELECT *
export const getAllLabs = async (req, res) => {
    const { data, error } = await supabase
        .from('lab')
        .select('labid, title, description, benefit(description)')
        .order('labid', { ascending: false });

    if (error) {
        console.error('Get labs error:', error);
        return res.status(500).json({ message: 'Failed to fetch labs', error: error.message });
    }

    res.json(data);
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