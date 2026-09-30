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