// Este archivo se encarga de guardar el reporte de evidencia que el runner recolecta de cada intento
// de laboratorio (historial de bash, conexiones y procesos).
import { supabase } from '../config/supabaseClient.js';

// Postgres text columns reject NUL characters
// Esta constante se encarga de limpiar el texto quitando los caracteres NUL que Postgres rechaza.
const clean = (text) => String(text ?? '').replace(/\0/g, '');

// Saves what the runner collected from one attempt (one row per attempt).
// collected: false means the lab was already down (for example a second stop call): save nothing.
// Esta función se encarga de guardar la evidencia de un intento como una fila en la tabla report;
// si el runner no recolectó nada (lab ya caído), no guarda nada.
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