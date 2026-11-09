// Este archivo se encarga de gestionar el ciclo de vida completo de las sesiones de
// laboratorio: iniciarlas, seguir su progreso contra el runner, reiniciarlas, cerrarlas,
// validar las flags y repartir trofeos y XP cuando una sesión termina.
import { supabase } from '../config/supabaseClient.js';
import { awardTrophies } from './trophyService.js';
import { awardSessionXp } from './xpService.js';
import { checkBadgesSafely } from './badgeService.js';
import { saveEvidenceReport } from './reportService.js';
import { logEvent } from './logService.js';
import { RUNNER_URL } from '../config/runner.js';
import { hasPendingUpdate, applyPendingUpdates } from './labUpdateService.js';

// Las flags incorrectas no se registran una por una (la sesión ya las cuenta en failedflags):
// solo se deja una advertencia cuando la cuenta llega a este número
const FLAG_WARNING_THRESHOLD = 10;

// Esta constante se encarga de formatear una duración en segundos como "MM:SS" para los registros.
const formatDuration = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// Esta función se encarga de transformar una fila cruda de la tabla session en el objeto
// resumido que espera el frontend (título del lab y estado legible).
function mapSession(row) {
    return {
        id: row.sessionid,
        laboratory: row.lab?.title ?? 'Laboratorio desconocido',
        startTime: row.starttime,
        endTime: row.finishtime,
        status: row.iscompleted ? 'finished' : 'running',
    };
}

// Esta función se encarga de devolver todas las sesiones de un usuario, ya mapeadas y
// ordenadas de la más reciente a la más antigua.
export async function getSessionsForUser(userid) {
    // Consulta a Supabase: trae las sesiones del usuario junto al título de su laboratorio.
    const { data, error } = await supabase
        .from('session')
        .select('sessionid, starttime, finishtime, iscompleted, lab(title)')
        .eq('userid', userid)
        .order('starttime', { ascending: false });

    if (error) throw error;

    return data.map(mapSession);
}

// Esta función se encarga de buscar una sesión concreta con todo su detalle; lanza un
// error 404 si no existe.
export async function getSessionById(sessionid) {
    const { data, error } = await supabase
        .from('session')
        .select('sessionid, userid, labid, iscompleted, issolved, port, protocol, starttime, finishtime, startstatus, startphase, starterror, lab(title, instructions), users(role)')
        .eq('sessionid', sessionid)
        .single();

    if (error || !data) {
        const err = new Error('Sesión no encontrada');
        err.status = 404;
        throw err;
    }

    return data;
}

// The trophies a session unlocked (only NEW ones are linked to it). The session page asks for them
// when it finds out the session ended on its own, for example when an admin applied a lab update.
// A problem reading them must never break the page, so it answers an empty list.
// Esta función se encarga de devolver los trofeos que desbloqueó una sesión; si falla la
// lectura responde con una lista vacía para no romper la página.
export async function getSessionTrophies(sessionid) {
    const { data, error } = await supabase
        .from('trophyuser')
        .select('trophy(type, name, description)')
        .eq('sessionid', sessionid);

    if (error) {
        console.error('Session trophies read error:', error);
        return [];
    }

    return data.map((row) => row.trophy).filter(Boolean);
}

// A lab with a pending zip + flag update takes no NEW sessions (see labUpdateService), so every open
// session finishes with the zip and flag it started with. The page recognises err.details.code.
const LAB_UPDATING_MESSAGE = 'Este laboratorio se está actualizando. Podrás iniciarlo de nuevo en unos minutos.';

// Esta función se encarga de construir el error 409 que indica que el laboratorio se está
// actualizando y no admite nuevas sesiones.
function labUpdatingError() {
    const err = new Error(LAB_UPDATING_MESSAGE);
    err.status = 409;
    err.details = { code: 'LAB_UPDATING' };
    return err;
}

// The zip path is read again right before downloading, so a session never starts from a zip
// that was replaced while the request was on its way
// Esta función se encarga de leer la ruta actual del zip del laboratorio justo antes de
// descargarlo, para que una sesión nunca arranque con un zip ya reemplazado.
async function readCurrentZipPath(labid) {
    const { data, error } = await supabase
        .from('lab')
        .select('zippath')
        .eq('labid', labid)
        .eq('isdeleted', false)
        .single();

    if (error || !data?.zippath) {
        const err = new Error('Lab or zip path not found');
        err.status = 404;
        throw err;
    }

    return data.zippath;
}

// un lab eliminadono se puede iniciar ni reiniciar, pero las sesiones que ya
// estaban en curso pueden terminarse
// Esta función se encarga de comprobar que el laboratorio existe y no está eliminado;
// lanza un 404 cuando ya no está disponible.
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
// Esta función se encarga de actualizar una sesión solo si sigue con el startstatus esperado
// y aún está abierta; devuelve true si cambió alguna fila (evita procesar dos veces lo mismo).
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
// Esta función se encarga de sincronizar el estado de arranque de una sesión con lo que
// reporta el runner (en progreso, lista, fallida o cancelada), sin procesos en segundo plano.
export async function refreshStartStatus(session, logContext = {}, { verifyReady = false } = {}) {
    if (session.iscompleted) return session;

    const isStarting = session.startstatus === 'starting';
    const mustVerify = verifyReady && session.startstatus === 'ready';
    if (!isStarting && !mustVerify) return session;

    const actor = logContext.actor ?? { userid: session.userid };
    const ip = logContext.ip;
    const title = session.lab?.title ?? 'laboratorio';
    const sessionid = session.sessionid;
    // tooOld: un arranque que supera el tiempo límite se trata como fallido.
    const tooOld = isStarting
        && !!session.starttime
        && Date.now() - new Date(session.starttime).getTime() > START_TIMEOUT_MS;

    // Llamada al runner: pregunta en qué fase va el arranque de esta sesión.
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
    // Verificación de una sesión ya 'ready': si el runner la da por caída, se cierra.
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
    // El lab ya está listo: se marca como 'ready' y se reinicia el reloj en este instante.
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
    // Sigue construyéndose: solo se guarda la fase nueva si cambió respecto a la anterior.
    if (IN_PROGRESS_PHASES.includes(phase) && !tooOld) {
        if (phase !== session.startphase) {
            await updateIfStatus(sessionid, 'starting', { startphase: phase });
        }
        return { ...session, startphase: phase };
    }

    // Cancelled on the runner
    // Cancelado en el runner: se cierra la sesión como cancelada.
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
        // Llamada al runner para asegurarse de que no quede nada corriendo en la VM (sin esperar respuesta).
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
// Esta función se encarga de buscar la sesión abierta que un usuario ya tiene en un lab para
// reutilizarla; si resulta estar muerta la cierra y devuelve null.
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

    // Antes de reutilizarla se refresca contra el runner para confirmar que sigue viva.
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
// Esta función se encarga de reiniciar una sesión como un intento nuevo: pide al runner que
// reconstruya el lab, guarda la evidencia del intento anterior y reinicia el reloj.
export async function restartTrainingSession({ labid, sessionid, actor, ip }) {
    await assertLabAvailable(labid);

    // Llamada al runner para reconstruir el laboratorio de esta sesión.
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
    // Guarda la evidencia del intento que se acaba de cerrar, sin romper si falla.
    try {
        await saveEvidenceReport({ sessionid, evidence: runnerResult.evidence });
    } catch (err) {
        console.error('Save report error (restart):', err);
    }

    const starttime = new Date().toISOString();

    // Lee el número de reinicios previos para incrementarlo en uno.

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
// Esta función se encarga de iniciar un laboratorio: crea la sesión, entrega el zip al runner
// y responde enseguida; la construcción ocurre en segundo plano y la página la va siguiendo.
export async function startTrainingSession({ labid, userid, actor, ip }) {
    // Consulta a Supabase: obtiene la ruta del zip y el título del lab (si no está eliminado).
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

    // A lab waiting for an update takes no new sessions (the ones already open keep working)
    if (await hasPendingUpdate(labid)) throw labUpdatingError();

    // Crea la fila de la sesión en estado 'starting'/'preparing'.
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
        // Checked again now that the session exists: an update queued a moment ago must not be
        // applied under a session that is only just starting
        if (await hasPendingUpdate(labid)) throw labUpdatingError();

        const zippath = await readCurrentZipPath(labid);

        const { data: zipBlob, error: downloadError } = await supabase
            .storage
            .from('labfiles')
            .download(zippath);

        if (downloadError) throw downloadError;

        const zipBuffer = Buffer.from(await zipBlob.arrayBuffer());

        // Arma el multipart con el zip del lab para enviarlo al runner.
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
        // El runner no aceptó el inicio: se cierra la sesión para que no bloquee al usuario.
        const { error: closeError } = await supabase
            .from('session')
            .update({
                iscompleted: true,
                finishtime: new Date().toISOString(),
                startstatus: 'failed',
                startphase: 'failed',
                starterror: err.details?.code === 'LAB_UPDATING'
                    ? LAB_UPDATING_MESSAGE
                    : 'No se pudo contactar con el servicio de laboratorios.',
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
// This is also where the trophies are judged and the XP is awarded, so it covers every way
// a session can end.
// A session that is still starting is a CANCEL: the runner kills the build, and there is
// nothing to judge (no evidence, no trophies, no XP).
// logContext = { actor, ip }: solo para el registro de actividad
// Esta función se encarga de cerrar una sesión y, pase lo que pase, disparar al final la
// revisión de actualizaciones pendientes del lab (sin esperarla y sin que pueda romper el cierre).
export async function stopTrainingSession(sessionid, finishedAt = new Date().toISOString(), logContext = {}) {
    try {
        return await closeTrainingSession(sessionid, finishedAt, logContext);
    } finally {
        // The session that just ended may have been the last one a pending update was waiting for.
        // Not awaited and never throws: it must not slow down or break closing the session.
        applyPendingUpdates().catch((err) => console.error('Pending update check failed:', err.message || err));
    }
}

// Esta función se encarga de la lógica real de cierre de una sesión: avisa al runner, marca
// la sesión como completada, guarda evidencia y reparte trofeos y XP en la primera finalización.
async function closeTrainingSession(sessionid, finishedAt, logContext = {}) {
    const { actor, ip } = logContext;

    // What the trophies need. A failure here must not stop the lab from closing.
    // Consulta a Supabase: trae los datos que necesitan los trofeos; si falla no se aborta el cierre.
    const { data: row, error: rowError } = await supabase
        .from('session')
        .select('userid, labid, starttime, failedflags, issolved, startstatus')
        .eq('sessionid', sessionid)
        .single();

    if (rowError) console.error('Session read error before stop:', rowError);

    // Cancelling a lab that is still being built
    // Si el lab aún se estaba construyendo, cerrar es cancelar: se aborta el build en el runner.
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

        return { finishtime: cancelled?.[0]?.finishtime ?? null, trophies: [], xp: null };
    }

    // Llamada al runner para detener los contenedores de la sesión y recibir la evidencia.
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
    // Reparto de trofeos (solo en la primera finalización); un error aquí no rompe el cierre.
    let trophies = [];
    if (firstCompletion && row) {
        try {
            trophies = await awardTrophies({
                userid: row.userid,
                labid: row.labid,
                sessionid,
                solved: row.issolved,
                elapsedSeconds: (new Date(finishedAt) - new Date(row.starttime)) / 1000,
                failedFlags: row.failedflags ?? 0,
                evidence: runnerResult.evidence,
            });
        } catch (err) {
            console.error('Award trophies error:', err);
        }
    }

    // XP: the lab's score (only if the session ended by solving it) plus the XP of the trophies
    // unlocked in this session. Trophies can be earned without solving, so this runs for every
    // session that ends. An XP problem must never break closing the session.
    // Reparto de XP (puntos del lab si se resolvió + XP de los trofeos nuevos); un error no rompe el cierre.
    let xp = null;
    if (firstCompletion && row) {
        try {
            const result = await awardSessionXp({
                userid: row.userid,
                labid: row.labid,
                sessionid,
                solved: !!row.issolved,
                trophies,
            });
            xp = result.xp;
            trophies = result.trophies; // same trophies, each now with the XP it gave
        } catch (err) {
            console.error('Award XP error:', err);
        }
    }

    // Una sola fila por sesión terminada: resuelta (con el tiempo) o cerrada sin resolver
    // Registro de actividad del cierre, con nota del dueño y del XP ganado cuando aplica.
    if (firstCompletion) {
        const elapsed = row ? (new Date(finishedAt) - new Date(row.starttime)) / 1000 : NaN;
        const ownerNote = row && actor && actor.userid !== row.userid
            ? ` (sesión del usuario #${row.userid})`
            : '';
        const xpNote = xp?.earned > 0 ? ` (+${xp.earned} XP)` : '';

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
                }${ownerNote}${xpNote}`
                : `Cerró la sesión #${sessionid} sin resolver el laboratorio${ownerNote}${xpNote}`,
        });
    }

    return { finishtime: updated?.[0]?.finishtime ?? null, trophies, xp };
}

// logContext = { actor, ip }: solo para el registro de actividad
// Esta función se encarga de validar la flag que envía el estudiante: si acierta, marca la
// sesión como resuelta y la cierra; si falla, cuenta el intento y avisa al llegar al umbral.
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

    // Compara la flag enviada con la correcta del lab (ambas recortadas de espacios).
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

    // Marked as solved BEFORE stopping: the stop flow reads this to judge the trophies and the XP
    // Se marca como resuelta ANTES de cerrar, porque el cierre usa este dato para trofeos y XP.
    const { error: updateError } = await supabase
        .from('session')
        .update({ capturedflag: submittedFlag.trim(), issolved: true })
        .eq('sessionid', sessionid);

    if (updateError) console.error('Capturedflag update error:', updateError);

    // Closes the session, saves the evidence, awards trophies and XP and logs "SESSION_SOLVED"
    const { finishtime, trophies, xp } = await stopTrainingSession(sessionid, finishedAt, logContext);

    // badges
    const badges = await checkBadgesSafely(session.userid);

    return { matched: true, finishtime, trophies, xp, badges };
}
