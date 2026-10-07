import { supabase } from '../config/supabaseClient.js';

function isEarned(trophy, { solved, elapsedSeconds, failedFlags }) {
    // Every criterion available today needs the lab to be solved
    if (!solved) return false;

    switch (trophy.criteriatype) {
        case 'completion':
            return true;
        case 'time':
            return elapsedSeconds < Number(trophy.criteria);
        case 'failed_attempts':
            return failedFlags <= Number(trophy.criteria);
        default:
            // command / process: the platform has no evidence to check them yet
            return false;
    }
}

// Works out which trophies a finished session earned, saves the new unlocks and returns them.
// Only NEW unlocks come back, so a trophy the player already owns never shows up twice.
export async function awardTrophies({ userid, labid, solved, elapsedSeconds, failedFlags }) {
    const { data: trophies, error: trophyError } = await supabase
        .from('trophy')
        .select('trophyid, type, name, description, criteriatype, criteria')
        .eq('labid', labid);

    if (trophyError) throw trophyError;

    const earned = trophies.filter((trophy) =>
        isEarned(trophy, { solved, elapsedSeconds, failedFlags })
    );

    if (earned.length === 0) return [];

    // ignoreDuplicates: a trophy already in trophyuser is skipped, and only the rows
    // that were really inserted come back
    const { data: inserted, error: insertError } = await supabase
        .from('trophyuser')
        .upsert(
            earned.map((trophy) => ({ trophyid: trophy.trophyid, userid })),
            { onConflict: 'trophyid,userid', ignoreDuplicates: true }
        )
        .select('trophyid');

    if (insertError) throw insertError;

    const newIds = new Set(inserted.map((row) => row.trophyid));

    return earned
        .filter((trophy) => newIds.has(trophy.trophyid))
        .map(({ type, name, description }) => ({ type, name, description }));
}