// Este archivo se encarga de los trofeos de los laboratorios: decide qué trofeos ganó una sesión
// terminada según su criterio y guarda solo los desbloqueos nuevos del usuario.
import { supabase } from '../config/supabaseClient.js';
import { evidenceMatches } from '../utils/trophyCriteria.js';

// Esta función se encarga de decidir si un trofeo se ganó, según su tipo de criterio (completar,
// tiempo, intentos fallidos, comando ejecutado o proceso detectado).
function isEarned(trophy, { solved, elapsedSeconds, failedFlags, evidence }) {
    switch (trophy.criteriatype) {
        case 'completion':
            return solved;
        case 'time':
            return solved && elapsedSeconds < Number(trophy.criteria);
        case 'failed_attempts':
            return solved && failedFlags <= Number(trophy.criteria);
        // These two look at what the student did, so they count even if the lab was not solved
        case 'command':
            return evidenceMatches(evidence?.bash, trophy.criteria);
        case 'process':
            return evidenceMatches(evidence?.processes, trophy.criteria);
        default:
            return false;
    }
}

// Works out which trophies a finished session earned, saves the new unlocks and returns them.
// Only NEW unlocks come back, so a trophy the player already owns never shows up twice.
// Esta función se encarga de calcular los trofeos que ganó una sesión terminada, guardar los
// desbloqueos nuevos y devolver únicamente esos (nunca repite uno que el usuario ya tenía).
export async function awardTrophies({ userid, labid, sessionid = null, solved, elapsedSeconds, failedFlags, evidence }) {
    const { data: trophies, error: trophyError } = await supabase
        .from('trophy')
        .select('trophyid, type, name, description, criteriatype, criteria')
        .eq('labid', labid);

    if (trophyError) throw trophyError;

    // Filtra, de todos los trofeos del laboratorio, los que esta sesión cumple
    const earned = trophies.filter((trophy) =>
        isEarned(trophy, { solved, elapsedSeconds, failedFlags, evidence })
    );

    if (earned.length === 0) return [];

    // ignoreDuplicates: a trophy already in trophyuser is skipped, and only the rows
    // that were really inserted come back
    const { data: inserted, error: insertError } = await supabase
        .from('trophyuser')
        .upsert(
            // sessionid: which session unlocked it, so the session page can show it again
            earned.map((trophy) => ({ trophyid: trophy.trophyid, userid, sessionid })),
            { onConflict: 'trophyid,userid', ignoreDuplicates: true }
        )
        .select('trophyid');

    if (insertError) throw insertError;

    // De los ganados, deja solo los que de verdad se insertaron ahora (desbloqueos nuevos)
    const newIds = new Set(inserted.map((row) => row.trophyid));

    return earned
        .filter((trophy) => newIds.has(trophy.trophyid))
        .map(({ type, name, description }) => ({ type, name, description }));
}