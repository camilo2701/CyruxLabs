import { supabase } from '../config/supabaseClient.js';

// Postgres text columns reject NUL characters
const clean = (text) => String(text ?? '').replace(/\0/g, '');

// Saves what the runner collected from one attempt (one row per attempt).
// collected: false means the lab was already down (for example a second stop call): save nothing.
export async function saveEvidenceReport({ sessionid, evidence }) {
    if (!evidence?.collected) return;

    const { error } = await supabase.from('report').insert([{
        sessionid,
        dateofcreation: new Date().toISOString().split('T')[0],
        bashhistory: clean(evidence.bash),
        endpointshistory: clean(evidence.connections),
        pidhistory: clean(evidence.processes),
    }]);

    if (error) throw error;
}