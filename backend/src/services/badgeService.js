import { supabase } from '../config/supabaseClient.js';

const TIME_ZONE = 'America/Santiago';
const DAY_MS = 24 * 60 * 60 * 1000;

const chileDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

export function toChileDate(isoString) {
    return chileDateFormatter.format(new Date(isoString));
}

function daysBetween(fromDate, toDate) {
    const [y1, m1, d1] = fromDate.split('-').map(Number);
    const [y2, m2, d2] = toDate.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

// racha actual en días. el usuario tiene hasta las 23:59 de hoy para mantenerla.
export function getCurrentStreak(activeDates, today = toChileDate(new Date().toISOString())) {
    const days = [...new Set(activeDates)].sort();
    if (days.length === 0 || daysBetween(days[days.length - 1], today) > 1) return 0;

    let streak = 1;
    for (let i = days.length - 1; i > 0; i--) {
        if (daysBetween(days[i - 1], days[i]) !== 1) break;
        streak += 1;
    }
    return streak;
}

export function evaluateBadges(catalog, sessions, { accountDate } = {}) {
    const solved = sessions
        .filter((s) => s.issolved && s.finishtime && s.starttime)
        .map((s) => ({ ...s, day: toChileDate(s.finishtime) }))
        .sort((a, b) => new Date(a.finishtime) - new Date(b.finishtime));

    // fechas en que se alcanzó cada valor, recorriendo las sesiones en orden.
    const distinctLabs = new Set();
    const labsReachedOn = [];          // cantidad de labds
    const cleanLabs = new Set();
    const cleanReachedOn = [];         // flags sin fallos
    const fastestBefore = [];          // tiempo de resolucion
    const streakReachedOn = [];        // racha de dias

    let lastDay = null;
    let currentStreak = 0;

    solved.forEach((session) => {
        if (!distinctLabs.has(session.labid)) {
            distinctLabs.add(session.labid);
            labsReachedOn.push({ day: session.day, sessionid: session.sessionid });
        }

        if ((session.failedflags ?? 0) === 0 && !cleanLabs.has(session.labid)) {
            cleanLabs.add(session.labid);
            cleanReachedOn.push({ day: session.day, sessionid: session.sessionid });
        }

        const minutes = (new Date(session.finishtime) - new Date(session.starttime)) / 60000;
        if (minutes >= 0) fastestBefore.push({ minutes, day: session.day, sessionid: session.sessionid });

        if (session.day !== lastDay) {
            currentStreak = lastDay && daysBetween(lastDay, session.day) === 1 ? currentStreak + 1 : 1;
            lastDay = session.day;
            if (currentStreak > streakReachedOn.length) {
                streakReachedOn.push({ day: session.day, sessionid: session.sessionid });
            }
        }
    });

    const achieved = new Map();

    catalog.forEach((badge) => {
        const n = badge.criteria;
        let reached = null;

        switch (badge.category) {
            case 'account':
                if (accountDate) reached = { day: accountDate, sessionid: null };
                break;
            case 'labs':
                reached = labsReachedOn[n - 1] ?? null;
                break;
            case 'no_fail':
                reached = cleanReachedOn[n - 1] ?? null;
                break;
            case 'streak':
                reached = streakReachedOn[n - 1] ?? null;
                break;
            case 'time':
                reached = fastestBefore.find((s) => s.minutes < n) ?? null;
                break;
            default:
                break;
        }

        if (reached) achieved.set(badge.badgeid, { day: reached.day, sessionid: reached.sessionid ?? null });
    });

    return achieved;
}

// revisa al usuario y le otorga las insignias que cumple y aún no tiene
export async function checkBadges(userid) {
    const [userResult, catalogResult, ownedResult, sessionsResult] = await Promise.all([
        supabase.from('users').select('userid, dateofcreation').eq('userid', userid).maybeSingle(),
        supabase.from('badges').select('badgeid, name, description, category, type, criteria').not('category', 'is', null),
        supabase.from('userbadge').select('badgeid').eq('userid', userid),
        supabase
            .from('session')
            .select('sessionid, labid, starttime, finishtime, issolved, failedflags')
            .eq('userid', userid)
            .eq('issolved', true),
    ]);

    for (const result of [userResult, catalogResult, ownedResult, sessionsResult]) {
        if (result.error) throw result.error;
    }
    if (!userResult.data) return [];

    const owned = new Set(ownedResult.data.map((row) => row.badgeid));
    const pending = catalogResult.data.filter((badge) => !owned.has(badge.badgeid));
    if (pending.length === 0) return [];

    const achieved = evaluateBadges(pending, sessionsResult.data, {
        accountDate: userResult.data.dateofcreation,
    });
    if (achieved.size === 0) return [];

    const rows = [...achieved].map(([badgeid, { day, sessionid }]) => ({
        badgeid,
        userid,
        dateofunlock: day,
        sessionid, // sesión en que se ganó 
    }));

    const { error } = await supabase
        .from('userbadge')
        .upsert(rows, { onConflict: 'badgeid,userid', ignoreDuplicates: true });
    if (error) throw error;

    return pending
        .filter((badge) => achieved.has(badge.badgeid))
        .map((badge) => ({ ...badge, dateofunlock: achieved.get(badge.badgeid).day }));
}

export async function checkBadgesSafely(userid) {
    try {
        return await checkBadges(userid);
    } catch (err) {
        console.error('[badges] Error revisando insignias del usuario', userid, err);
        return [];
    }
}

// badges sin desbloquear + progreso de c/u

// orden  por categoría y, dentro de c/u, por rareza
const CATEGORY_ORDER = ['labs', 'time', 'streak', 'no_fail', 'account'];

// Números actuales del usuario a partir de sus sesiones resueltas (lógica pura)
export function computeBadgeStats(sessions, today) {
    const solved = sessions.filter((s) => s.issolved && s.finishtime && s.starttime);

    const distinctLabs = new Set(solved.map((s) => s.labid));
    const cleanLabs = new Set(solved.filter((s) => (s.failedflags ?? 0) === 0).map((s) => s.labid));

    const minutes = solved
        .map((s) => (new Date(s.finishtime) - new Date(s.starttime)) / 60000)
        .filter((m) => m >= 0);

    return {
        labs: distinctLabs.size,
        cleanLabs: cleanLabs.size,
        bestMinutes: minutes.length > 0 ? Math.min(...minutes) : null,
        currentStreak: getCurrentStreak(solved.map((s) => toChileDate(s.finishtime)), today),
    };
}

const plural = (n, singular, pluralForm) => (n === 1 ? singular : pluralForm);

export function getBadgeProgress(badge, stats) {
    const n = badge.criteria;
    const capped = (value) => Math.min(value, n);
    const percentOf = (value) => Math.round((capped(value) / n) * 100);

    switch (badge.category) {
        case 'labs':
            return {
                percent: percentOf(stats.labs),
                label: `${capped(stats.labs)} / ${n} ${plural(n, 'lab', 'labs')}`,
            };
        case 'no_fail':
            return {
                percent: percentOf(stats.cleanLabs),
                label: `${capped(stats.cleanLabs)} / ${n} ${plural(n, 'lab', 'labs')} sin fallos`,
            };
        case 'streak':
            return {
                percent: percentOf(stats.currentStreak),
                label: `Racha actual: ${capped(stats.currentStreak)} / ${n} ${plural(n, 'día', 'días')}`,
            };
        case 'time': {
            if (stats.bestMinutes === null) return { percent: 0, label: 'Aún sin labs resueltos' };
            // Más cerca de la meta = barra más llena (ej. meta 15 min, mejor 30 min → 50 %)
            const best = Math.ceil(stats.bestMinutes);
            return {
                percent: Math.min(99, Math.round((n / Math.max(stats.bestMinutes, 0.01)) * 100)),
                label: `Mejor tiempo: ${best} min`,
            };
        }
        default:
            return null;
    }
}

export async function getLockedBadges(userid) {
    const [catalogResult, ownedResult, sessionsResult] = await Promise.all([
        supabase.from('badges').select('badgeid, name, description, category, type, criteria').not('category', 'is', null),
        supabase.from('userbadge').select('badgeid').eq('userid', userid),
        supabase
            .from('session')
            .select('labid, starttime, finishtime, issolved, failedflags')
            .eq('userid', userid)
            .eq('issolved', true),
    ]);

    for (const result of [catalogResult, ownedResult, sessionsResult]) {
        if (result.error) throw result.error;
    }

    const owned = new Set(ownedResult.data.map((row) => row.badgeid));
    const stats = computeBadgeStats(sessionsResult.data);

    return catalogResult.data
        .filter((badge) => !owned.has(badge.badgeid))
        .sort(
            (a, b) =>
                CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
                a.type - b.type ||
                a.criteria - b.criteria
        )
        .map(({ criteria, ...badge }) => ({ ...badge, progress: getBadgeProgress({ ...badge, criteria }, stats) }));
}

export async function getLockedBadgesSafely(userid) {
    try {
        return await getLockedBadges(userid);
    } catch (err) {
        console.error('[badges] Error obteniendo insignias sin desbloquear del usuario', userid, err);
        return [];
    }
}
