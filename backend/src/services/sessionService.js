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
        .select('sessionid, userid, labid, iscompleted, issolved, port, protocol, starttime, finishtime, lab(title, instructions)')
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

    const now = new Date();
    const { data: sessionData, error: sessionError } = await supabase
        .from('session')
        .insert([{
            labid,
            userid,
            dateofcreation: now.toISOString().split('T')[0],
            starttime: now.toISOString(),
            iscompleted: false,
        }])
        .select();

    if (sessionError) throw sessionError;

    const sessionid = sessionData[0].sessionid;

    let runnerResult;

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

        const runnerResponse = await fetch(`${RUNNER_URL}/start`, {
            method: 'POST',
            body: formData,
        });

        runnerResult = await runnerResponse.json();

        if (!runnerResponse.ok) {
            const err = new Error('Runner failed to start lab');
            err.details = runnerResult;
            throw err;
        }
    } catch (err) {
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

    const { error: updateError } = await supabase
        .from('session')
        .update({ port: runnerResult.port, protocol: runnerResult.protocol })
        .eq('sessionid', sessionid);

    if (updateError) console.error('Session port update error:', updateError);

    logEvent({
        actor,
        ip,
        action: 'CREATE',
        facility: 'session',
        event: 'SESSION_STARTED',
        targetid: sessionid,
        description: `Inició el laboratorio «${labData.title}» (sesión #${sessionid})`,
    });

    return { sessionid, port: runnerResult.port, protocol: runnerResult.protocol };
}

// finishedAt defaults to "now", evaluated when this function is CALLED, so it is
// taken before the runner starts tearing the containers down.
// This is also where the trophies are judged, so it covers every way a session can end.
// logContext = { actor, ip }: solo para el registro de actividad
export async function stopTrainingSession(sessionid, finishedAt = new Date().toISOString(), logContext = {}) {
    const { actor, ip } = logContext;

    // What the trophies need. A failure here must not stop the lab from closing.
    const { data: row, error: rowError } = await supabase
        .from('session')
        .select('userid, labid, starttime, failedflags, issolved')
        .eq('sessionid', sessionid)
        .single();

    if (rowError) console.error('Session read error before stop:', rowError);

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