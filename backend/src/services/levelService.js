import { supabase } from '../config/supabaseClient.js';

// sistema de lvl basado en score. maximo 10 lvls
//   lvl1: 0 – 999
//   lvl2: 1000 – 2499
//   lvl3: 2500 – 4499
//   lvl4: 4500 – 6999
//   lvl5: 7000 – 9999
//   lvl6:  10000 – 13999
//   lvl7:  14000 – 18999
//   lvl8:  19000 – 24999
//   lvl9:  25000 – 31999
//   lvl10: 32000 o más

export const LEVEL_THRESHOLDS = [0, 1000, 2500, 4500, 7000, 10000, 14000, 19000, 25000, 32000];
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export function getLevelFromScore(score = 0) {
    const safeScore = Math.max(0, Number(score) || 0);
    let level = 1;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
        if (safeScore >= LEVEL_THRESHOLDS[i]) level = i + 1;
    }
    return level;
}

// info para la barra de progreso del perfil
export function getLevelInfo(score = 0) {
    const safeScore = Math.max(0, Number(score) || 0);
    const level = getLevelFromScore(safeScore);
    const currentLevelMin = LEVEL_THRESHOLDS[level - 1];
    const isMaxLevel = level === MAX_LEVEL;
    const nextLevelMin = isMaxLevel ? null : LEVEL_THRESHOLDS[level];

    const progress = isMaxLevel
        ? 100
        : Math.floor(((safeScore - currentLevelMin) / (nextLevelMin - currentLevelMin)) * 100);

    return {
        level,
        maxLevel: MAX_LEVEL,
        score: safeScore,
        currentLevelMin,
        nextLevelMin,
        pointsToNextLevel: isMaxLevel ? 0 : nextLevelMin - safeScore,
        progress,
    };
}

// PENDIENTE PENDIENTE PENDIENTE
// suma puntos a un usuario y recalcula lvl
// llamar desde donde se defina el criterio de puntaje (por ejemplo en sessionService.submitFlag cuando matched = true)
export async function addScore(userid, points) {
    const pointsToAdd = Number(points);
    if (!Number.isInteger(pointsToAdd) || pointsToAdd <= 0) {
        throw new Error('Los puntos deben ser un entero positivo');
    }

    const { data: current, error: fetchError } = await supabase
        .from('users')
        .select('score, level')
        .eq('userid', userid)
        .single();
    if (fetchError) throw fetchError;

    const newScore = (current.score || 0) + pointsToAdd;
    const newLevel = getLevelFromScore(newScore);

    const { error: updateError } = await supabase
        .from('users')
        .update({ score: newScore, level: newLevel })
        .eq('userid', userid);
    if (updateError) throw updateError;

    return {
        score: newScore,
        level: newLevel,
        leveledUp: newLevel > current.level,
    };
}

// otorga una badge
export async function awardBadge(userid, badgeid) {
    const { error } = await supabase
        .from('userbadge')
        .upsert({ userid, badgeid }, { onConflict: 'badgeid,userid', ignoreDuplicates: true });
    if (error) throw error;
}
