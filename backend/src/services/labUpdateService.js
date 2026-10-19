import { supabase } from '../config/supabaseClient.js';
import { RUNNER_URL } from '../config/runner.js';
import { logEvent } from './logService.js';

// Changing a lab's zip and flag is never immediate. The new pair is stored as a PENDING update
// (table labupdate) and applied only when the lab has no open session:
//   - a student who is playing keeps the old zip, so the old flag must keep working for them
//   - while an update is pending, nobody can START a new session of that lab (see sessionService)
//   - the update is applied by whoever notices the lab is free: the end of a session, the
//     one-minute sweeper below, or the instructor opening the lab
// Applying is: forget the runner's cached zip -> point the lab at the new zip and flag -> delete the old zip.

const BUCKET = 'labfiles';
const SWEEP_INTERVAL_MS = 60 * 1000;
const FORCE_CLOSE_MESSAGE = 'El laboratorio se actualizó y la sesión se cerró.';

// Labs whose update is being applied right now by this process, so two triggers never overlap
const applying = new Set();

// Best effort: a file that could not be removed is only logged
async function removeFile(filePath) {
    if (!filePath) return;

    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) console.error('Storage remove failed:', filePath, error);
}

async function setLastError(labid, message) {
    const { error } = await supabase.from('labupdate').update({ lasterror: message }).eq('labid', labid);
    if (error) console.error('Pending update lasterror write failed:', error);
}

// ---------- Reading ----------

export async function getPendingUpdate(labid) {
    const { data, error } = await supabase
        .from('labupdate')
        .select('labid, newzippath, newflag, requestedby, dateofcreation, lasterror')
        .eq('labid', labid)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function hasPendingUpdate(labid) {
    const { data, error } = await supabase
        .from('labupdate')
        .select('labid')
        .eq('labid', labid)
        .limit(1);

    if (error) throw error;
    return data.length > 0;
}

// lab.flag is UNIQUE (deleted labs included) and a flag can only be queued by one lab, so a flag
// is taken when ANOTHER lab has it or ANOTHER lab has it queued. exceptLabId = the lab being edited.
export async function isFlagTaken(flag, exceptLabId = null) {
    let labQuery = supabase.from('lab').select('labid').eq('flag', flag).limit(1);
    let pendingQuery = supabase.from('labupdate').select('labid').eq('newflag', flag).limit(1);

    if (exceptLabId !== null) {
        labQuery = labQuery.neq('labid', exceptLabId);
        pendingQuery = pendingQuery.neq('labid', exceptLabId);
    }

    const [labResult, pendingResult] = await Promise.all([labQuery, pendingQuery]);
    if (labResult.error) throw labResult.error;
    if (pendingResult.error) throw pendingResult.error;

    return labResult.data.length > 0 || pendingResult.data.length > 0;
}

// The lab's sessions that are still open. A 'ready' session is checked against the runner first,
// so a session whose containers are gone (VM reboot...) is closed instead of blocking the update forever.
export async function getOpenSessions(labid) {
    const { data, error } = await supabase
        .from('session')
        .select('sessionid, userid, labid, iscompleted, startstatus, startphase, starterror, port, protocol, starttime, lab(title)')
        .eq('labid', labid)
        .eq('iscompleted', false);

    if (error) throw error;

    // Loaded here (not at the top) because sessionService also imports this file
    const { refreshStartStatus } = await import('./sessionService.js');

    const checked = await Promise.all(
        data.map((row) =>
            refreshStartStatus(row, {}, { verifyReady: true }).catch((err) => {
                console.error('Open session check failed:', err.message);
                return row; // when in doubt it counts as open
            })
        )
    );

    return checked.filter((session) => !session.iscompleted);
}

// ---------- Queueing and cancelling ----------

// Stores the new zip in the bucket under its own name (the old zip is never touched) and saves the
// pending row, replacing any earlier pending update of the lab. The caller has already validated both.
// Throws the database error as it is: code 23505 means another lab already queued that flag.
export async function queueUpdate({ labid, userid, flag, zipBuffer }) {
    const newzippath = `labs/${labid}/bundle-${Date.now()}.zip`;

    const { error: uploadError } = await supabase
        .storage
        .from(BUCKET)
        .upload(newzippath, zipBuffer, { contentType: 'application/zip' });

    if (uploadError) throw uploadError;

    const previous = await getPendingUpdate(labid).catch(() => null);

    const { error: saveError } = await supabase
        .from('labupdate')
        .upsert(
            {
                labid,
                newzippath,
                newflag: flag,
                requestedby: userid,
                dateofcreation: new Date().toISOString(),
                lasterror: null,
            },
            { onConflict: 'labid' }
        );

    if (saveError) {
        await removeFile(newzippath);
        throw saveError;
    }

    // The zip of the update that was just replaced is no longer needed
    if (previous && previous.newzippath !== newzippath) await removeFile(previous.newzippath);

    return { newzippath };
}

async function discardPending(pending) {
    const { error } = await supabase.from('labupdate').delete().eq('labid', pending.labid);
    if (error) throw error;

    await removeFile(pending.newzippath);
}

// Removes the pending update and its zip. Returns false when there was none.
export async function cancelUpdate(labid) {
    const pending = await getPendingUpdate(labid);
    if (!pending) return false;

    await discardPending(pending);
    return true;
}

// ---------- Applying ----------

// Tells the runner to forget its cached zip of the lab, so the next start takes the new one
async function invalidateRunnerCache(labid) {
    const response = await fetch(`${RUNNER_URL}/cache/${labid}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) throw new Error(`The runner answered ${response.status}`);
}

// Only for the admin's "apply now": stops every open session of the lab. Nobody gets trophies or XP
// from these sessions. If the runner cannot stop one, this throws and the update is NOT applied.
async function closeSessionsForUpdate(openSessions, { actor, ip }) {
    for (const session of openSessions) {
        const response = await fetch(`${RUNNER_URL}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionid: session.sessionid }),
            signal: AbortSignal.timeout(90_000),
        });

        if (!response.ok) {
            throw new Error(`The runner could not stop session #${session.sessionid}`);
        }

        const { error } = await supabase
            .from('session')
            .update({
                iscompleted: true,
                finishtime: new Date().toISOString(),
                startstatus: 'failed',
                startphase: 'failed',
                starterror: FORCE_CLOSE_MESSAGE,
            })
            .eq('sessionid', session.sessionid)
            .eq('iscompleted', false);

        if (error) console.error('Forced session close update error:', error);

        logEvent({
            actor,
            ip,
            action: 'UPDATE',
            facility: 'session',
            event: 'SESSION_CLOSED_BY_UPDATE',
            severity: 'warning',
            targetid: Number(session.sessionid),
            description: `Se cerró la sesión #${session.sessionid} para aplicar una actualización del laboratorio #${session.labid}`,
        });
    }
}

async function applyUpdate(labid, { force, actor, ip }) {
    const pending = await getPendingUpdate(labid);
    if (!pending) return { applied: false, reason: 'none' };

    const { data: lab, error: labError } = await supabase
        .from('lab')
        .select('labid, title, zippath, isdeleted')
        .eq('labid', labid)
        .maybeSingle();

    if (labError) throw labError;

    // A deleted lab has nothing to update
    if (!lab || lab.isdeleted) {
        await discardPending(pending);
        return { applied: false, reason: 'lab_deleted' };
    }

    const openSessions = await getOpenSessions(labid);

    if (openSessions.length > 0 && !force) {
        return { applied: false, reason: 'sessions', openSessions: openSessions.length };
    }

    if (openSessions.length > 0) {
        await closeSessionsForUpdate(openSessions, { actor, ip });
    }

    // Order matters. With the lab free and new sessions blocked, nothing can start between these
    // two steps. If the second fails, the runner simply caches the OLD zip again on the next start.
    try {
        await invalidateRunnerCache(labid);
    } catch (err) {
        const message = 'No se pudo contactar con el runner de laboratorios. Se reintentará automáticamente.';
        await setLastError(labid, message);

        if (pending.lasterror !== message) {
            logEvent({
                actor,
                ip,
                action: 'UPDATE',
                facility: 'lab',
                event: 'LAB_UPDATE_FAILED',
                severity: 'error',
                targetid: labid,
                description: `No se pudo aplicar la actualización del laboratorio #${labid}: ${err.message}`,
            });
        }
        return { applied: false, reason: 'runner' };
    }

    const { error: flipError } = await supabase
        .from('lab')
        .update({ zippath: pending.newzippath, flag: pending.newflag })
        .eq('labid', labid);

    if (flipError) {
        const message = flipError.code === '23505'
            ? 'La flag nueva ya está en uso en otro laboratorio. Cancela la actualización y elige otra.'
            : 'No se pudo guardar la actualización. Se reintentará automáticamente.';
        await setLastError(labid, message);

        if (pending.lasterror !== message) {
            logEvent({
                actor,
                ip,
                action: 'UPDATE',
                facility: 'lab',
                event: 'LAB_UPDATE_FAILED',
                severity: 'error',
                targetid: labid,
                description: `No se pudo aplicar la actualización del laboratorio #${labid}: ${flipError.message}`,
            });
        }
        return { applied: false, reason: 'database' };
    }

    // The lab now uses the new pair. Only now is the pending row removed, so new sessions stay
    // blocked until the very end.
    const { error: deleteError } = await supabase.from('labupdate').delete().eq('labid', labid);
    if (deleteError) throw deleteError;

    if (lab.zippath && lab.zippath !== pending.newzippath) await removeFile(lab.zippath);

    logEvent({
        actor,
        ip,
        action: 'UPDATE',
        facility: 'lab',
        event: 'LAB_UPDATE_APPLIED',
        targetid: labid,
        description: `Se aplicó la actualización de archivo y flag del laboratorio «${lab.title}» (#${labid})${
            openSessions.length > 0 ? `, cerrando ${openSessions.length} sesión(es) abierta(s)` : ''
        }`,
    });

    return { applied: true };
}

// Applies the lab's pending update if the lab is free (or if force is true: admin only, closes the open sessions).
// Never throws for "not now" reasons; the answer says what happened:
//   { applied: true } | { applied: false, reason: 'none' | 'sessions' | 'runner' | 'database' | 'busy' | 'lab_deleted', openSessions? }
export async function tryApplyUpdate(labid, { force = false, actor = null, ip = null } = {}) {
    if (applying.has(labid)) return { applied: false, reason: 'busy' };

    applying.add(labid);
    try {
        return await applyUpdate(labid, { force, actor, ip });
    } finally {
        applying.delete(labid);
    }
}

// One pass over every pending update
export async function applyPendingUpdates() {
    const { data, error } = await supabase.from('labupdate').select('labid');
    if (error) throw error;

    for (const row of data) {
        try {
            await tryApplyUpdate(row.labid);
        } catch (err) {
            console.error(`Pending update of lab ${row.labid} failed:`, err.message || err);
        }
    }
}

// The backend has no scheduler, so this small timer is what guarantees a pending update is applied
// even when nobody closes a session or opens the lab page. The pending rows live in the database,
// so a backend restart loses nothing.
export function startPendingUpdateSweeper(intervalMs = SWEEP_INTERVAL_MS) {
    const timer = setInterval(() => {
        applyPendingUpdates().catch((err) => console.error('Pending update sweep failed:', err.message || err));
    }, intervalMs);

    timer.unref(); // never keeps the process alive by itself
    return timer;
}
