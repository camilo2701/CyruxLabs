import { supabase } from '../config/supabaseClient.js';
import { awardTrophies } from './trophyService.js';
import { checkBadgesSafely } from './badgeService.js';
import { saveEvidenceReport } from './reportService.js';

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

// A restart is a NEW attempt: the clock starts over, from the moment the new lab is ready.
// Restarts are also counted (restartcount) for the report.
export async function restartTrainingSession({ labid, sessionid }) {
    const runnerResponse = await fetch(`${RUNNER_URL}/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labid, sessionid }),
    });

    const runnerResult = await runnerResponse.json();

    if (!runnerResponse.ok) {
        const err = new Error('Runner failed to restart lab');
        err.details = runnerResult;
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

    const { error: updateError } = await supabase
        .from('session')
        .update({
            port: runnerResult.port,
            protocol: runnerResult.protocol,
            starttime,
            restartcount: (current?.restartcount ?? 0) + 1,
        })
        .eq('sessionid', sessionid);

    if (updateError) console.error('Session port update error:', updateError);

    return { port: runnerResult.port, protocol: runnerResult.protocol, starttime };
}

export async function startTrainingSession({ labid, userid }) {
    const { data: labData, error: labError } = await supabase
        .from('lab')
        .select('zippath')
        .eq('labid', labid)
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

    const runnerResult = await runnerResponse.json();

    if (!runnerResponse.ok) {
        const err = new Error('Runner failed to start lab');
        err.details = runnerResult;
        throw err;
    }

    const { error: updateError } = await supabase
        .from('session')
        .update({ port: runnerResult.port, protocol: runnerResult.protocol })
        .eq('sessionid', sessionid);

    if (updateError) console.error('Session port update error:', updateError);

    return { sessionid, port: runnerResult.port, protocol: runnerResult.protocol };
}

// finishedAt defaults to "now", evaluated when this function is CALLED, so it is
// taken before the runner starts tearing the containers down.
// This is also where the trophies are judged, so it covers every way a session can end.
export async function stopTrainingSession(sessionid, finishedAt = new Date().toISOString()) {
    // What the trophies need. A failure here must not stop the lab from closing.
    const { data: row, error: rowError } = await supabase
        .from('session')
        .select('userid, labid, starttime, failedflags, issolved')
        .eq('sessionid', sessionid)
        .single();

    if (rowError) console.error('Session read error before stop:', rowError);

    const runnerResponse = await fetch(`${RUNNER_URL}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionid }),
    });

    const runnerResult = await runnerResponse.json();

    if (!runnerResponse.ok) {
        const err = new Error('Runner failed to stop lab');
        err.details = runnerResult;
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

    return { finishtime: updated?.[0]?.finishtime ?? null, trophies };
}

export async function submitFlag(sessionid, submittedFlag) {
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
        // Count the wrong flag: the failed-attempts trophies use this number
        const { error: countError } = await supabase
            .from('session')
            .update({ failedflags: (session.failedflags ?? 0) + 1 })
            .eq('sessionid', sessionid);

        if (countError) console.error('Failed flag count error:', countError);

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

    // Closes the session, saves the evidence and awards the trophies
    const { finishtime, trophies } = await stopTrainingSession(sessionid, finishedAt);

    // badges
    const badges = await checkBadgesSafely(session.userid);

    return { matched: true, finishtime, trophies, badges };
}