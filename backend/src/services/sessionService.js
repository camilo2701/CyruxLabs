import { supabase } from '../config/supabaseClient.js';
import { awardTrophies } from './trophyService.js';
import { checkBadgesSafely } from './badgeService.js';
import { saveEvidenceReport } from './reportService.js';
import { logEvent } from './logService.js';

// Las flags incorrectas no se registran una por una (la sesión ya las cuenta en failedflags):
// solo se deja una advertencia cuando la cuenta llega a este número
const FLAG_WARNING_THRESHOLD = 10;

const formatDuration = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

function mapSession(row) {
    return {
        id: row.sessionid,
        laboratory: row.lab?.title ?? 'Laboratorio desconocido',
        startTime: row.starttime,
        endTime: row.finishtime,
        status: row.iscompleted ? 'finished' : 'running',
    };
}

export async function getSessionsForUser(userid) {
    const { data, error } = await supabase
        .from('session')
        .select('sessionid, starttime, finishtime, iscompleted, lab(title)')
        .eq('userid', userid)
        .order('starttime', { ascending: false });

    if (error) throw error;

    return data.map(mapSession);
}

export async function getSessionById(sessionid) {
    const { data, error } = await supabase
        .from('session')
        .select('sessionid, userid, labid, iscompleted, issolved, port, protocol, starttime, finishtime, startstatus, startphase, starterror, lab(title, instructions)')
        .eq('sessionid', sessionid)
        .single();

    if (error || !data) {
        const err = new Error('Sesión no encontrada');
        err.status = 404;
        throw err;
    }

    return data;
}

const RUNNER_URL = 'http://10.10.0.12:4000';

// un lab eliminadono se puede iniciar ni reiniciar, pero las sesiones que ya
// estaban en curso pueden terminarse
async function assertLabAvailable(labid) {
    const { data: lab, error } = await supabase
        .from('lab')
        .select('isdeleted')
        .eq('labid', labid)
        .maybeSingle();

    if (error) throw error;

    if (!lab || lab.isdeleted) {
        const err = new Error('Este laboratorio ya no está disponible');
        err.status = 404;
        throw err;
    }

}
// Phases the runner reports while a lab is starting
const IN_PROGRESS_PHASES = ['preparing', 'building', 'starting', 'finalizing'];

// A start that takes longer than this is treated as failed
const START_TIMEOUT_MS = 15 * 60 * 1000;

// Updates a session only if it still has the expected startstatus and is still open.
// Returns true when a row changed, so two requests can never process the same change twice.
async function updateIfStatus(sessionid, expectedStatus, fields) {
    const { data, error } = await supabase
        .from('session')
        .update(fields)
        .eq('sessionid', sessionid)
        .eq('startstatus', expectedStatus)
        .eq('iscompleted', false)
        .select('sessionid');

    if (error) {
        console.error('Session start update error:', error);
        return false;
    }

    return data.length > 0;
}

// Brings the start state of a session up to date with what the runner says.
//  - A session that is 'starting' follows the runner: progress, ready or failed.
//  - With verifyReady, a 'ready' session is also checked against the runner, and closed
//    if its containers no longer exist (VM rebooted, reset-all.sh...).
// Nothing runs in the background: this is called whenever somebody asks about the session,
// so it also survives a restart of this backend.
// logContext = { actor, ip }: solo para el registro de actividad
export async function refreshStartStatus(session, logContext = {}, { verifyReady = false } = {}) {
    if (session.iscompleted) return session;

    const isStarting = session.startstatus === 'starting';
    const mustVerify = verifyReady && session.startstatus === 'ready';
    if (!isStarting && !mustVerify) return session;

    const actor = logContext.actor ?? { userid: session.userid };
    const ip = logContext.ip;
    const title = session.lab?.title ?? 'laboratorio';
    const sessionid = session.sessionid;
    const tooOld = isStarting
        && !!session.starttime
        && Date.now() - new Date(session.starttime).getTime() > START_TIMEOUT_MS;

    let runnerState;
    try {
        const response = await fetch(`${RUNNER_URL}/status/${sessionid}`, { signal: AbortSignal.timeout(15_000) });
        runnerState = await response.json();
        if (!response.ok) throw new Error(runnerState.message || 'Runner status error');
    } catch (err) {
        console.error('Runner status error:', err.message);
        // The runner cannot be reached: keep what we know and ask again next time
        if (!tooOld) return session;
        runnerState = { phase: 'unknown' };
    }

    const phase = runnerState.phase;
    const nowIso = new Date().toISOString();

    // A 'ready' session being verified
    if (!isStarting) {
        if (phase === 'ready') return session;

        const closed = await updateIfStatus(sessionid, 'ready', {
            iscompleted: true,
            finishtime: nowIso,
            startstatus: 'failed',
            startphase: 'failed',
            starterror: 'El laboratorio ya no estaba activo.',
        });

        if (closed) {
            logEvent({
                actor,
                ip,
                action: 'UPDATE',
                facility: 'session',
                event: 'SESSION_CLOSED_STALE',
                severity: 'warning',
                targetid: Number(sessionid),
                description: `Se cerró la sesión #${sessionid} porque sus contenedores ya no estaban activos`,
            });
        }

        return { ...session, iscompleted: true, startstatus: 'failed', startphase: 'failed' };
    }

    // The lab is up. The clock starts NOW, so the build time never counts against the student.
    if (phase === 'ready') {
        const fields = {
            startstatus: 'ready',
            startphase: 'ready',
            port: runnerState.port,
            protocol: runnerState.protocol,
            starttime: nowIso,
        };

        const changed = await updateIfStatus(sessionid, 'starting', fields);

        if (changed) {
            logEvent({
                actor,
                ip,
                action: 'CREATE',
                facility: 'session',
                event: 'SESSION_STARTED',
                targetid: Number(sessionid),
                description: `Inició el laboratorio «${title}» (sesión #${sessionid})`,
            });
        }

        return { ...session, ...fields };
    }

    // Still working
    if (IN_PROGRESS_PHASES.includes(phase) && !tooOld) {
        if (phase !== session.startphase) {
            await updateIfStatus(sessionid, 'starting', { startphase: phase });
        }
        return { ...session, startphase: phase };
    }

    // Cancelled on the runner
    if (phase === 'cancelled') {
        await updateIfStatus(sessionid, 'starting', {
            iscompleted: true,
            finishtime: nowIso,
            startstatus: 'cancelled',
            startphase: 'cancelled',
        });
        return { ...session, iscompleted: true, startstatus: 'cancelled', startphase: 'cancelled' };
    }

    // Anything else (failed, unknown, stopped, too old) means this start will not finish
    const message = tooOld
        ? 'El laboratorio tardó demasiado en iniciar.'
        : (runnerState.error || 'No se pudo iniciar el laboratorio.');

    const changed = await updateIfStatus(sessionid, 'starting', {
        iscompleted: true,
        finishtime: nowIso,
        startstatus: 'failed',
        startphase: 'failed',
        starterror: message,
    });

    if (changed) {
        // Make sure nothing stays running on the VM (best effort)
        fetch(`${RUNNER_URL}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionid }),
        }).catch(() => {});

        logEvent({
            actor,
            ip,
            action: 'CREATE',
            facility: 'session',
            event: 'SESSION_START_FAILED',
            severity: 'error',
            targetid: Number(sessionid),
            description: `No se pudo iniciar el laboratorio «${title}» (sesión #${sessionid}): ${String(runnerState.detail || message).slice(-300)}`,
        });
    }

    return {
        ...session,
        iscompleted: true,
        startstatus: 'failed',
        startphase: 'failed',
        starterror: message,
    };
}

// A user has at most ONE open session per lab. If there is one, starting again takes the
// user back to it (still starting, or ready). One that turns out to be dead is closed here.
async function findReusableSession({ labid, userid }, logContext) {
    const { data, error } = await supabase
        .from('session')
        .select('sessionid, userid, labid, iscompleted, startstatus, startphase, starterror, port, protocol, starttime, lab(title)')
        .eq('userid', userid)
        .eq('labid', labid)
        .eq('iscompleted', false)
        .order('sessionid', { ascending: false })
        .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const session = await refreshStartStatus(data[0], logContext, { verifyReady: true });

    if (session.iscompleted) return null; // it was dead, and is closed now

    return {
        sessionid: session.sessionid,
        startstatus: session.startstatus,
        startphase: session.startphase,
        port: session.port,
        protocol: session.protocol,
        reused: true,
    };
}

// A restart is a NEW attempt: the clock starts over, from the moment the new lab is ready.
// Restarts are also counted (restartcount) for the report.
// actor / ip: quién lo hace y desde dónde, solo para el registro de actividad
export async function restartTrainingSession({ labid, sessionid, actor, ip }) {
    await assertLabAvailable(labid);

    let runnerResult;

    try {
        const runnerResponse = await fetch(`${RUNNER_URL}/restart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labid, sessionid }),
        });

        runnerResult = await runnerResponse.json();

        if (!runnerResponse.ok) {
            const err = new Error('Runner failed to restart lab');
            err.details = runnerResult;
            throw err;
        }
    } catch (err) {
        logEvent({
            actor,
            ip,
            action: 'UPDATE',
            facility: 'session',
            event: 'SESSION_RESTART_FAILED',
            severity: 'error',
            targetid: Number(sessionid),
            description: `No se pudo reiniciar la sesión #${sessionid}: ${err.message}`,
        });
        throw err;
    }

    // Keep what the student did in the attempt that was just closed
    try {
        await saveEvidenceReport({ sessionid, evidence: runnerResult.evidence });
    } catch (err) {
        console.error('Save report error (restart):', err);
    }

    const starttime = new Date().toISOString();

    const { data: current, error: readError } = await supabase
        .from('session')
        .select('restartcount')
        .eq('sessionid', sessionid)
        .single();

    if (readError) console.error('Session restartcount read error:', readError);

    const restartCount = (current?.restartcount ?? 0) + 1;

    const { error: updateError } = await supabase
        .from('session')
        .update({
            port: runnerResult.port,
            protocol: runnerResult.protocol,
            starttime,
            restartcount: restartCount,
        })
        .eq('sessionid', sessionid);

    if (updateError) console.error('Session port update error:', updateError);

    logEvent({
        actor,
        ip,
        action: 'UPDATE',
        facility: 'session',
        event: 'SESSION_RESTARTED',
        targetid: Number(sessionid),
        description: `Reinició la sesión #${sessionid} (reinicio n.º ${restartCount})`,
    });

    return { port: runnerResult.port, protocol: runnerResult.protocol, starttime };
}

// Starting a lab no longer waits for it to be ready: this creates the session, hands the zip
// to the runner and answers right away. The runner builds in the background and the page
// follows it with GET /api/sessions/:id (see refreshStartStatus).
// actor / ip: quién lo hace y desde dónde, solo para el registro de actividad
export async function startTrainingSession({ labid, userid, actor, ip }) {
    const { data: labData, error: labError } = await supabase
        .from('lab')
        .select('zippath, title')
        .eq('labid', labid)
        .eq('isdeleted', false)
        .single();

    if (labError || !labData?.zippath) {
        const err = new Error('Lab or zip path not found');
        err.status = 404;
        throw err;
    }

    // One open session per user and lab: starting again takes them back to it
    const reusable = await findReusableSession({ labid, userid }, { actor, ip });
    if (reusable) return reusable;

    const now = new Date();
    const { data: sessionData, error: sessionError } = await supabase
        .from('session')
        .insert([{
            labid,
            userid,
            dateofcreation: now.toISOString().split('T')[0],
            starttime: now.toISOString(),
            iscompleted: false,
            startstatus: 'starting',
            startphase: 'preparing',
        }])
        .select();

    if (sessionError) {
        // 23505 = the unique index on open sessions: another request created it a moment ago
        if (sessionError.code === '23505') {
            const existing = await findReusableSession({ labid, userid }, { actor, ip });
            if (existing) return existing;
        }
        throw sessionError;
    }

    const sessionid = sessionData[0].sessionid;

    try {
        const { data: zipBlob, error: downloadError } = await supabase
            .storage
            .from('labfiles')
            .download(labData.zippath);

        if (downloadError) throw downloadError;

        const zipBuffer = Buffer.from(await zipBlob.arrayBuffer());

        const formData = new FormData();
        formData.append('labid', String(labid));
        formData.append('sessionid', String(sessionid));
        formData.append('zipfile', new Blob([zipBuffer]), 'bundle.zip');

        // The runner only accepts the start here (202); the build happens in the background
        const runnerResponse = await fetch(`${RUNNER_URL}/start`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(60_000),
        });

        const runnerResult = await runnerResponse.json();

        if (!runnerResponse.ok) {
            const err = new Error('Runner failed to start lab');
            err.details = runnerResult;
            throw err;
        }
    } catch (err) {
        // The runner never took the start: close the session so it can't block the user
        const { error: closeError } = await supabase
            .from('session')
            .update({
                iscompleted: true,
                finishtime: new Date().toISOString(),
                startstatus: 'failed',
                startphase: 'failed',
                starterror: 'No se pudo contactar con el servicio de laboratorios.',
            })
            .eq('sessionid', sessionid);

        if (closeError) console.error('Session close error after failed start:', closeError);

        logEvent({
            actor,
            ip,
            action: 'CREATE',
            facility: 'session',
            event: 'SESSION_START_FAILED',
            severity: 'error',
            targetid: sessionid,
            description: `No se pudo iniciar el laboratorio «${labData.title}» (sesión #${sessionid}): ${err.message}`,
        });
        throw err;
    }

    return {
        sessionid,
        startstatus: 'starting',
        startphase: 'preparing',
        port: null,
        protocol: null,
        reused: false,
    };
}

// finishedAt defaults to "now", evaluated when this function is CALLED, so it is
// taken before the runner starts tearing the containers down.
// This is also where the trophies are judged, so it covers every way a session can end.
// A session that is still starting is a CANCEL: the runner kills the build, and there is
// nothing to judge (no evidence, no trophies).
// logContext = { actor, ip }: solo para el registro de actividad
export async function stopTrainingSession(sessionid, finishedAt = new Date().toISOString(), logContext = {}) {
    const { actor, ip } = logContext;

    // What the trophies need. A failure here must not stop the lab from closing.
    const { data: row, error: rowError } = await supabase
        .from('session')
        .select('userid, labid, starttime, failedflags, issolved, startstatus')
        .eq('sessionid', sessionid)
        .single();

    if (rowError) console.error('Session read error before stop:', rowError);

    // Cancelling a lab that is still being built
    if (row && row.startstatus === 'starting') {
        try {
            const runnerResponse = await fetch(`${RUNNER_URL}/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionid }),
            });

            if (!runnerResponse.ok) {
                const err = new Error('Runner failed to cancel the start');
                err.details = await runnerResponse.json().catch(() => ({}));
                throw err;
            }
        } catch (err) {
            logEvent({
                actor: actor ?? { userid: row.userid },
                ip,
                action: 'UPDATE',
                facility: 'session',
                event: 'SESSION_STOP_FAILED',
                severity: 'error',
                targetid: Number(sessionid),
                description: `No se pudo cancelar el inicio de la sesión #${sessionid} (los contenedores pueden seguir activos): ${err.message}`,
            });
            throw err;
        }

        const { data: cancelled, error: cancelError } = await supabase
            .from('session')
            .update({
                iscompleted: true,
                finishtime: finishedAt,
                startstatus: 'cancelled',
                startphase: 'cancelled',
            })
            .eq('sessionid', sessionid)
            .eq('iscompleted', false)
            .select('finishtime');

        if (cancelError) console.error('Session cancel update error:', cancelError);

        if (cancelled?.[0]) {
            logEvent({
                actor: actor ?? { userid: row.userid },
                ip,
                action: 'UPDATE',
                facility: 'session',
                event: 'SESSION_START_CANCELLED',
                targetid: Number(sessionid),
                description: `Canceló el inicio del laboratorio (sesión #${sessionid})`,
            });
        }

        return { finishtime: cancelled?.[0]?.finishtime ?? null, trophies: [] };
    }

    let runnerResult;

    try {
        const runnerResponse = await fetch(`${RUNNER_URL}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionid }),
        });

        runnerResult = await runnerResponse.json();

        if (!runnerResponse.ok) {
            const err = new Error('Runner failed to stop lab');
            err.details = runnerResult;
            throw err;
        }
    } catch (err) {
        logEvent({
            actor: actor ?? (row ? { userid: row.userid } : null),
            ip,
            action: 'UPDATE',
            facility: 'session',
            event: 'SESSION_STOP_FAILED',
            severity: 'error',
            targetid: Number(sessionid),
            description: `No se pudo cerrar la sesión #${sessionid} (los contenedores pueden seguir activos): ${err.message}`,
        });
        throw err;
    }

    const { data: updated, error: updateError } = await supabase
        .from('session')
        .update({ iscompleted: true, finishtime: finishedAt })
        .eq('sessionid', sessionid)
        .eq('iscompleted', false)
        .select('finishtime');

    if (updateError) console.error('Session update error:', updateError);

    // false when the session was already completed (a second stop call)
    const firstCompletion = !!updated?.[0];

    // What the student did in the terminal (the runner only sends it the first time)
    try {
        await saveEvidenceReport({ sessionid, evidence: runnerResult.evidence });
    } catch (err) {
        console.error('Save report error (stop):', err);
    }

    // A trophy problem must never break closing the session
    let trophies = [];
    if (firstCompletion && row) {
        try {
            trophies = await awardTrophies({
                userid: row.userid,
                labid: row.labid,
                solved: row.issolved,
                elapsedSeconds: (new Date(finishedAt) - new Date(row.starttime)) / 1000,
                failedFlags: row.failedflags ?? 0,
                evidence: runnerResult.evidence,
            });
        } catch (err) {
            console.error('Award trophies error:', err);
        }
    }

    // Una sola fila por sesión terminada: resuelta (con el tiempo) o cerrada sin resolver
    if (firstCompletion) {
        const elapsed = row ? (new Date(finishedAt) - new Date(row.starttime)) / 1000 : NaN;
        const ownerNote = row && actor && actor.userid !== row.userid
            ? ` (sesión del usuario #${row.userid})`
            : '';

        logEvent({
            actor: actor ?? (row ? { userid: row.userid } : null),
            ip,
            action: 'UPDATE',
            facility: 'session',
            event: row?.issolved ? 'SESSION_SOLVED' : 'SESSION_STOPPED',
            targetid: Number(sessionid),
            description: row?.issolved
                ? `Resolvió el laboratorio y cerró la sesión #${sessionid}${
                    Number.isFinite(elapsed) ? ` en ${formatDuration(elapsed)}` : ''
                }${ownerNote}`
                : `Cerró la sesión #${sessionid} sin resolver el laboratorio${ownerNote}`,
        });
    }

    return { finishtime: updated?.[0]?.finishtime ?? null, trophies };
}

// logContext = { actor, ip }: solo para el registro de actividad
export async function submitFlag(sessionid, submittedFlag, logContext = {}) {
    const { data: session, error: sessionError } = await supabase
        .from('session')
        .select('sessionid, userid, labid, iscompleted, failedflags, lab(flag)')
        .eq('sessionid', sessionid)
        .single();

    if (sessionError || !session) {
        const err = new Error('Sesión no encontrada');
        err.status = 404;
        throw err;
    }

    if (session.iscompleted) {
        return { matched: false, alreadyCompleted: true };
    }

    const correctFlag = session.lab?.flag;
    const matched = !!correctFlag && submittedFlag.trim() === correctFlag.trim();

    if (!matched) {
        const failedFlags = (session.failedflags ?? 0) + 1;

        // Count the wrong flag: the failed-attempts trophies use this number
        const { error: countError } = await supabase
            .from('session')
            .update({ failedflags: failedFlags })
            .eq('sessionid', sessionid);

        if (countError) console.error('Failed flag count error:', countError);

        if (!countError && failedFlags === FLAG_WARNING_THRESHOLD) {
            logEvent({
                actor: logContext.actor,
                ip: logContext.ip,
                action: 'UPDATE',
                facility: 'session',
                event: 'FLAG_ATTEMPTS_HIGH',
                severity: 'warning',
                targetid: Number(sessionid),
                description: `La sesión #${sessionid} acumula ${FLAG_WARNING_THRESHOLD} flags incorrectas`,
            });
        }

        return { matched: false };
    }

    // Take the finish time NOW, before the database writes and the teardown below
    const finishedAt = new Date().toISOString();

    // Marked as solved BEFORE stopping: the stop flow reads this to judge the trophies
    const { error: updateError } = await supabase
        .from('session')
        .update({ capturedflag: submittedFlag.trim(), issolved: true })
        .eq('sessionid', sessionid);

    if (updateError) console.error('Capturedflag update error:', updateError);

    // Closes the session, saves the evidence, awards the trophies and logs "SESSION_SOLVED"
    const { finishtime, trophies } = await stopTrainingSession(sessionid, finishedAt, logContext);

    // badges
    const badges = await checkBadgesSafely(session.userid);

    return { matched: true, finishtime, trophies, badges };
}
