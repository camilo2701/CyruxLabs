// Este archivo se encarga de la lógica de insignias: calcula cuáles cumple el usuario, se las otorga y reporta su progreso en las que aún no tiene.
import { supabase } from '../config/supabaseClient.js';

const TIME_ZONE = 'America/Santiago';
const DAY_MS = 24 * 60 * 60 * 1000;

// Esta constante se encarga de formatear fechas a la zona horaria de Chile en formato AAAA-MM-DD.
const chileDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

// Esta función se encarga de convertir una fecha ISO a su día calendario (AAAA-MM-DD) en hora de Chile.
export function toChileDate(isoString) {
    return chileDateFormatter.format(new Date(isoString));
}

// Esta función se encarga de calcular cuántos días hay entre dos fechas "AAAA-MM-DD".
function daysBetween(fromDate, toDate) {
    const [y1, m1, d1] = fromDate.split('-').map(Number);
    const [y2, m2, d2] = toDate.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

// racha actual en días. el usuario tiene hasta las 23:59 de hoy para mantenerla.
// Esta función se encarga de calcular la racha de días consecutivos activos que lleva el usuario.
export function getCurrentStreak(activeDates, today = toChileDate(new Date().toISOString())) {
    // Quita días repetidos y ordena; si el último día activo es anterior a ayer, la racha ya se perdió.
    const days = [...new Set(activeDates)].sort();
    if (days.length === 0 || daysBetween(days[days.length - 1], today) > 1) return 0;

    // Retrocede desde el día más reciente sumando mientras los días sean consecutivos.
    let streak = 1;
    for (let i = days.length - 1; i > 0; i--) {
        if (daysBetween(days[i - 1], days[i]) !== 1) break;
        streak += 1;
    }
    return streak;
}

// Esta función se encarga de determinar, para un catálogo de insignias, en qué fecha y sesión el usuario cumplió cada criterio.
export function evaluateBadges(catalog, sessions, { accountDate } = {}) {
    // Toma solo las sesiones resueltas y con tiempos válidos, les asigna su día y las ordena cronológicamente.
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

    // Recorre las sesiones en orden y va anotando en qué momento se alcanzó cada hito (labs, flags sin fallos, tiempo, racha).
    solved.forEach((session) => {
        // Primera vez que se resuelve este lab: suma a la cuenta de labs distintos.
        if (!distinctLabs.has(session.labid)) {
            distinctLabs.add(session.labid);
            labsReachedOn.push({ day: session.day, sessionid: session.sessionid });
        }

        // Lab resuelto sin ninguna flag fallida y por primera vez: cuenta como lab "limpio".
        if ((session.failedflags ?? 0) === 0 && !cleanLabs.has(session.labid)) {
            cleanLabs.add(session.labid);
            cleanReachedOn.push({ day: session.day, sessionid: session.sessionid });
        }

        // Guarda cuánto tardó (en minutos) para las insignias por tiempo.
        const minutes = (new Date(session.finishtime) - new Date(session.starttime)) / 60000;
        if (minutes >= 0) fastestBefore.push({ minutes, day: session.day, sessionid: session.sessionid });

        // Al cambiar de día, extiende la racha si el día anterior fue consecutivo; si no, la reinicia.
        if (session.day !== lastDay) {
            currentStreak = lastDay && daysBetween(lastDay, session.day) === 1 ? currentStreak + 1 : 1;
            lastDay = session.day;
            if (currentStreak > streakReachedOn.length) {
                streakReachedOn.push({ day: session.day, sessionid: session.sessionid });
            }
        }
    });

    const achieved = new Map();

    // Para cada insignia del catálogo, busca si su umbral (criteria) ya se alcanzó según su categoría.
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

        // Si se alcanzó, anota la insignia con el día y la sesión en que se consiguió.
        if (reached) achieved.set(badge.badgeid, { day: reached.day, sessionid: reached.sessionid ?? null });
    });

    return achieved;
}

// revisa al usuario y le otorga las insignias que cumple y aún no tiene
// Esta función se encarga de revisar a un usuario y otorgarle en la base las insignias que cumple y todavía no posee.
export async function checkBadges(userid) {
    // Consultas a Supabase en paralelo: datos del usuario, catálogo de insignias, las que ya tiene y sus sesiones resueltas.
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

    // Propaga cualquier error de las consultas.
    for (const result of [userResult, catalogResult, ownedResult, sessionsResult]) {
        if (result.error) throw result.error;
    }
    if (!userResult.data) return [];

    // De todo el catálogo, deja solo las insignias que el usuario aún no tiene.
    const owned = new Set(ownedResult.data.map((row) => row.badgeid));
    const pending = catalogResult.data.filter((badge) => !owned.has(badge.badgeid));
    if (pending.length === 0) return [];

    // Evalúa cuáles de las pendientes se cumplen con las sesiones del usuario.
    const achieved = evaluateBadges(pending, sessionsResult.data, {
        accountDate: userResult.data.dateofcreation,
    });
    if (achieved.size === 0) return [];

    // Prepara las filas a insertar en userbadge con la fecha y sesión de desbloqueo.
    const rows = [...achieved].map(([badgeid, { day, sessionid }]) => ({
        badgeid,
        userid,
        dateofunlock: day,
        sessionid, // sesión en que se ganó 
    }));

    // Inserta las nuevas insignias; ignora duplicados por si ya se otorgaron en paralelo.
    const { error } = await supabase
        .from('userbadge')
        .upsert(rows, { onConflict: 'badgeid,userid', ignoreDuplicates: true });
    if (error) throw error;

    // Devuelve las insignias recién ganadas con su fecha de desbloqueo.
    return pending
        .filter((badge) => achieved.has(badge.badgeid))
        .map((badge) => ({ ...badge, dateofunlock: achieved.get(badge.badgeid).day }));
}

// Esta función se encarga de ejecutar checkBadges capturando errores para que un fallo no interrumpa el flujo que la llama.
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
// Esta constante se encarga de fijar el orden en que se muestran las insignias por categoría.
const CATEGORY_ORDER = ['labs', 'time', 'streak', 'no_fail', 'account'];

// Números actuales del usuario a partir de sus sesiones resueltas (lógica pura)
// Esta función se encarga de calcular las métricas actuales del usuario (labs, labs limpios, mejor tiempo, racha) a partir de sus sesiones.
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

// Esta constante se encarga de elegir la forma singular o plural de una palabra según el número.
const plural = (n, singular, pluralForm) => (n === 1 ? singular : pluralForm);

// Esta función se encarga de calcular el porcentaje y la etiqueta de avance del usuario hacia una insignia concreta.
export function getBadgeProgress(badge, stats) {
    const n = badge.criteria;
    // Limita el valor al umbral y lo expresa como porcentaje de la meta.
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

// Esta función se encarga de devolver las insignias que el usuario aún no tiene, ordenadas y con su progreso calculado.
export async function getLockedBadges(userid) {
    // Consultas a Supabase en paralelo: catálogo, insignias ya obtenidas y sesiones resueltas.
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

    // Filtra las que ya tiene, ordena por categoría/rareza/criterio y adjunta a cada una su progreso.
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

// Esta función se encarga de ejecutar getLockedBadges capturando errores para devolver una lista vacía si algo falla.
export async function getLockedBadgesSafely(userid) {
    try {
        return await getLockedBadges(userid);
    } catch (err) {
        console.error('[badges] Error obteniendo insignias sin desbloquear del usuario', userid, err);
        return [];
    }
}
