import { supabase } from '../config/supabaseClient.js';

// ---------- Level curve ----------
// Level L starts at 250 * L * (L - 1) XP: level 2 at 500, level 3 at 1500, level 4 at 3000,
// level 5 at 5000... Each level costs more than the one before. To change the curve, only
// change XP_STEP (or these two functions); nothing lives in the database.
const XP_STEP = 250;

// Total XP needed to REACH a level (level 1 needs 0)
export function xpForLevel(level) {
    return XP_STEP * level * (level - 1);
}

export function levelForXp(xp) {
    let level = 1;
    while (xpForLevel(level + 1) <= xp) level += 1;
    return level;
}

// ---------- Adding XP ----------

const MAX_UPDATE_ATTEMPTS = 5;

// Adds XP to a user and keeps users.level in step with users.score.
// Supabase can't do "score = score + N" from here, so the write is conditional: it only
// goes through if the score is still the one we just read. If another request changed it in
// between, nothing is written and we read again, so two solves at the same moment can
// never overwrite each other.
async function addXpToUser(userid, points) {
    for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
        const { data: user, error: readError } = await supabase
            .from('users')
            .select('score')
            .eq('userid', userid)
            .single();

        if (readError) throw readError;

        const newScore = user.score + points;
        const newLevel = levelForXp(newScore);

        const { data: updated, error: updateError } = await supabase
            .from('users')
            .update({ score: newScore, level: newLevel })
            .eq('userid', userid)
            .eq('score', user.score) // only if nobody changed it since we read it
            .select('score');

        if (updateError) throw updateError;

        if (updated.length > 0) {
            return {
                total: newScore,
                level: newLevel,
                previousLevel: levelForXp(user.score),
            };
        }
        // Somebody else changed the score first: read it again and retry
    }

    throw new Error('No se pudo actualizar el XP (demasiados cambios simultáneos)');
}

// Gives a student the lab's score as XP when they solve it.
//  - Only the FIRST time they solve that lab counts (repeat solves earn nothing).
//  - The author of a lab earns nothing on their own lab.
// Called from stopTrainingSession, which already guarantees it runs once per session.
//
// Returns what the screen needs:
//   { earned, total, level, leveledUp }  when XP was given
//   { earned: 0, reason }                when it was not ('own_lab' | 'already_solved')
// It THROWS on database errors; the caller catches them so closing a session never fails.
export async function awardLabXp({ userid, labid, sessionid }) {
    // The lab is read even if it was deleted since: a session that was already running
    // can still be finished (deleted labs are only flagged, nothing is removed)
    const { data: lab, error: labError } = await supabase
        .from('lab')
        .select('score, userid')
        .eq('labid', labid)
        .single();

    if (labError) throw labError;

    if (lab.userid === userid) {
        return { earned: 0, reason: 'own_lab' };
    }

    // Any OTHER session of this user that already solved this lab?
    const { data: earlier, error: earlierError } = await supabase
        .from('session')
        .select('sessionid')
        .eq('userid', userid)
        .eq('labid', labid)
        .eq('issolved', true)
        .neq('sessionid', sessionid)
        .limit(1);

    if (earlierError) throw earlierError;

    if (earlier.length > 0) {
        return { earned: 0, reason: 'already_solved' };
    }

    const result = await addXpToUser(userid, lab.score);

    return {
        earned: lab.score,
        total: result.total,
        level: result.level,
        leveledUp: result.level > result.previousLevel,
    };
}