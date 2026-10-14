import { supabase } from '../config/supabaseClient.js';

export const LOG_ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE'];
export const LOG_FACILITIES = ['auth', 'user', 'lab', 'session'];
export const LOG_SEVERITIES = ['info', 'warning', 'error'];

const PAGE_SIZE = 15;
const DESCRIPTION_MAX = 300;
const NAME_MAX = 50;

// Descriptions are built by the server but can include text a user typed (a username, a title).
// Line breaks and control characters are removed so nobody can forge a fake log line.
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
function randomDocumentationIp() {
    return `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
}

export function clientIp(req) {
    return process.env.LOG_REAL_IP === 'true' ? req.ip : randomDocumentationIp();
}

// Who is acting, and from where. Use it in a controller: logEvent({ ...fromReq(req), ... })
export function fromReq(req) {
    return {
        actor: req.user ? { userid: req.user.userid, username: req.user.username } : null,
        ip: clientIp(req),
    };
}

async function writeLog({ actor, ip, action, facility, event, severity, targetid, description }) {
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
export function logEvent({ severity = 'info', ...entry }) {
    writeLog({ ...entry, severity }).catch((err) => {
        console.error('Log write failed:', err.message);
    });
}

// One page of logs, newest first. "before" is the id of the last log of the previous page.
export async function getLogs({ before, facility, action, severity }) {
    let query = supabase
        .from('activitylog')
        .select('logid, createdat, userid, username, action, facility, event, severity, targetid, description, ip')
        .order('logid', { ascending: false })
        .limit(PAGE_SIZE + 1); // one extra row tells us whether there is another page

    if (before) query = query.lt('logid', before);
    if (facility) query = query.eq('facility', facility);
    if (action) query = query.eq('action', action);
    if (severity) query = query.eq('severity', severity);

    const { data, error } = await query;
    if (error) throw error;

    const hasMore = data.length > PAGE_SIZE;
    return { logs: hasMore ? data.slice(0, PAGE_SIZE) : data, hasMore };
}