// Este archivo se encarga del registro de actividad: construye, sanea y guarda eventos en Supabase, y los lee paginados.
import { supabase } from '../config/supabaseClient.js';

// Estas constantes se encargan de definir los valores válidos de acción, área y severidad de un log.
export const LOG_ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE'];
export const LOG_FACILITIES = ['auth', 'user', 'lab', 'session'];
export const LOG_SEVERITIES = ['info', 'warning', 'error'];

const PAGE_SIZE = 15;
const DESCRIPTION_MAX = 300;
const NAME_MAX = 50;

// Descriptions are built by the server but can include text a user typed (a username, a title).
// Line breaks and control characters are removed so nobody can forge a fake log line.
// Esta función se encarga de limpiar un texto quitando caracteres de control y recortándolo al máximo dado.
function clean(value, max) {
    return String(value ?? '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .trim()
        .slice(0, max);
}

// The real client IP is only stored when LOG_REAL_IP=true (set it in the backend .env at deployment).
// Until then a random address from 203.0.113.0/24 is stored instead. That range is reserved for
// documentation, so a fake value can never be mistaken for (or point at) a real machine.
// Esta función se encarga de generar una IP ficticia del rango reservado para documentación.
function randomDocumentationIp() {
    return `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
}

// Esta función se encarga de devolver la IP real del cliente solo si está habilitado; si no, una ficticia.
export function clientIp(req) {
    return process.env.LOG_REAL_IP === 'true' ? req.ip : randomDocumentationIp();
}

// Who is acting, and from where. Use it in a controller: logEvent({ ...fromReq(req), ... })
// Esta función se encarga de extraer de la petición quién actúa (actor) y desde qué IP.
export function fromReq(req) {
    return {
        actor: req.user ? { userid: req.user.userid, username: req.user.username } : null,
        ip: clientIp(req),
    };
}

// Esta función se encarga de validar y escribir una entrada de log en la tabla activitylog de Supabase.
async function writeLog({ actor, ip, action, facility, event, severity, targetid, description }) {
    // Validación: la acción, el área y la severidad deben pertenecer a los conjuntos permitidos.
    if (!LOG_ACTIONS.includes(action) || !LOG_FACILITIES.includes(facility) || !LOG_SEVERITIES.includes(severity)) {
        throw new Error(`Invalid log entry: ${action} / ${facility} / ${severity}`);
    }

    // The token may not carry the name, so look it up once if needed
    let username = actor?.username ?? null;
    if (!username && actor?.userid) {
        const { data } = await supabase
            .from('users')
            .select('username')
            .eq('userid', actor.userid)
            .maybeSingle();
        username = data?.username ?? null;
    }

    // Inserta en Supabase la fila del log con todos sus campos saneados.
    const { error } = await supabase.from('activitylog').insert([{
        userid: actor?.userid ?? null,
        username: username ? clean(username, NAME_MAX) : null,
        action,
        facility,
        event: clean(event, 40),
        severity,
        targetid: Number.isInteger(targetid) ? targetid : null,
        description: clean(description, DESCRIPTION_MAX),
        ip: ip ? clean(ip, 64) : null,
    }]);

    if (error) throw error;
}

// Writes one log entry. It never throws and callers should NOT await it:
// a logging problem must not break (or slow down) the action being logged.
// Esta función se encarga de registrar un evento sin bloquear ni romper la acción si el log falla.
export function logEvent({ severity = 'info', ...entry }) {
    writeLog({ ...entry, severity }).catch((err) => {
        console.error('Log write failed:', err.message);
    });
}

// One page of logs, newest first. "before" is the id of the last log of the previous page.
// Esta función se encarga de leer una página de logs (más nuevos primero) aplicando cursor y filtros opcionales.
export async function getLogs({ before, facility, action, severity }) {
    let query = supabase
        .from('activitylog')
        .select('logid, createdat, userid, username, action, facility, event, severity, targetid, description, ip')
        .order('logid', { ascending: false })
        .limit(PAGE_SIZE + 1); // one extra row tells us whether there is another page

    // Consultas a Supabase: aplica el cursor y cada filtro solo si viene informado.
    if (before) query = query.lt('logid', before);
    if (facility) query = query.eq('facility', facility);
    if (action) query = query.eq('action', action);
    if (severity) query = query.eq('severity', severity);

    const { data, error } = await query;
    if (error) throw error;

    // Si llegó la fila extra, hay otra página; se descarta antes de devolver.
    const hasMore = data.length > PAGE_SIZE;
    return { logs: hasMore ? data.slice(0, PAGE_SIZE) : data, hasMore };
}