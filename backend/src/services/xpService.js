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

// Datos para la barra de progreso del perfil (niveles sin tope, misma curva de arriba)
export function getLevelInfo(score = 0) {
    const safeScore = Math.max(0, Number(score) || 0);
    const level = levelForXp(safeScore);
    const currentLevelMin = xpForLevel(level);
    const nextLevelMin = xpForLevel(level + 1);

    return {
        level,
        score: safeScore,
        currentLevelMin,
        nextLevelMin,
        pointsToNextLevel: nextLevelMin - safeScore,
        progress: Math.floor(((safeScore - currentLevelMin) / (nextLevelMin - currentLevelMin)) * 100),
    };
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

// ---------- Trophy XP ----------
// A trophy gives XP the first time a student unlocks it. The amount is a fixed number of XP for
// every 100 points of the lab's score, so harder labs give more:
//   bronze 5  ·  silver 10  ·  gold 20   (per 100 points of lab score)
//
//   lab score |  bronze | silver | gold
//       100   |     5   |   10   |  20
//       200   |    10   |   20   |  40
//       300   |    15   |   30   |  60
//       400   |    20   |   40   |  80
//       500   |    25   |   50   | 100
//
// Only whole numbers are multiplied (XP per 100 x number of hundreds), so there are never decimals.
// A lab has the automatic bronze trophy plus at most 3 of its own (see MAX_TROPHIES_BY_TYPE in
// labRules), so the trophies can add at most 45 % of the lab's score (5 + 20 + 10 + 10 per 100),
// and a typical lab adds 15-35 %. The lab itself stays the main source of XP.
// To rebalance, only change these numbers: nothing lives in the database.
const TROPHY_XP_PER_100 = { 0: 5, 1: 10, 2: 20 };

// XP of one trophy of a given type (0 bronze, 1 silver, 2 gold) in a lab with a given score.
// Math.floor only protects against a score that is not a multiple of 100 (it never is today).
export function trophyXp(type, labScore) {
    const perHundred = TROPHY_XP_PER_100[type] ?? 0;
    return perHundred * Math.floor(labScore / 100);
}

// ---------- Handing out the XP of a finished session ----------
// Called from stopTrainingSession, which already guarantees it runs once per session.
// It is what makes XP impossible to farm:
//  - The lab's score is given only the FIRST time that student solves that lab (later solves earn nothing).
//  - A trophy gives XP only when it is NEWLY unlocked. awardTrophies already filters out the ones the
//    student owns (trophyuser has one row per student and trophy), so `trophies` only has new ones.
//    An earned trophy cannot be deleted or recreated (see updateLab), so it cannot be earned twice either.
//  - The author of a lab earns no XP at all on their own lab (neither the score nor the trophies).
//  - All of it is added in ONE write, so the level is judged once with everything the session gave.
//
// solved   : the session ended by solving the lab
// trophies : the trophies unlocked in this session ([{ type, name, description }])
//
// Returns { xp, trophies }:
//   trophies: the same list, each one with the XP it gave ({ ..., xp })
//   xp: what the screen needs
//     { earned, lab, trophies, reason, total, level, leveledUp }  when XP was given
//         earned = lab + trophies; reason ('already_solved' | 'own_lab') says why lab is 0 on a solve
//     { earned: 0, lab: 0, trophies: 0, reason }                  when it solved but nothing was given
//     null                                                        when it did not solve and gave nothing
// It THROWS on database errors; the caller catches them so closing a session never fails.
export async function awardSessionXp({ userid, labid, sessionid, solved, trophies = [] }) {
    if (!solved && trophies.length === 0) return { xp: null, trophies };

    // The lab is read even if it was deleted since: a session that was already running
    // can still be finished (deleted labs are only flagged, nothing is removed)
    const { data: lab, error: labError } = await supabase
        .from('lab')
        .select('score, userid')
        .eq('labid', labid)
        .single();

    if (labError) throw labError;

    const labScore = lab.score ?? 0;
    const isOwnLab = lab.userid === userid;

    let labPoints = 0;
    let reason;

    if (solved) {
        if (isOwnLab) {
            reason = 'own_lab';
        } else {
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

            if (earlier.length > 0) reason = 'already_solved';
            else labPoints = labScore;
        }
    }

    const trophiesWithXp = trophies.map((trophy) => ({
        ...trophy,
        xp: isOwnLab ? 0 : trophyXp(trophy.type, labScore),
    }));
    const trophyPoints = trophiesWithXp.reduce((sum, trophy) => sum + trophy.xp, 0);

    const points = labPoints + trophyPoints;

    if (points === 0) {
        return {
            xp: solved ? { earned: 0, lab: 0, trophies: 0, reason } : null,
            trophies: trophiesWithXp,
        };
    }

    const result = await addXpToUser(userid, points);

    return {
        xp: {
            earned: points,
            lab: labPoints,
            trophies: trophyPoints,
            reason,
            total: result.total,
            level: result.level,
            leveledUp: result.level > result.previousLevel,
        },
        trophies: trophiesWithXp,
    };
}
