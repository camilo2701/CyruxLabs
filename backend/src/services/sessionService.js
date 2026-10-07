import { supabase } from '../config/supabaseClient.js';
import { awardTrophies } from './trophyService.js';

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
export async function stopTrainingSession(sessionid, finishedAt = new Date().toISOString()) {
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

    // null when the session was already completed (a second stop does not overwrite the time)
    return { finishtime: updated?.[0]?.finishtime ?? null };
}

export async function submitFlag(sessionid, submittedFlag) {
    const { data: session, error: sessionError } = await supabase
        .from('session')
        .select('sessionid, userid, labid, iscompleted, starttime, failedflags, lab(flag)')
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

    const { error: updateError } = await supabase
        .from('session')
        .update({ capturedflag: submittedFlag.trim(), issolved: true })
        .eq('sessionid', sessionid);

    if (updateError) console.error('Capturedflag update error:', updateError);

    // marca iscompleted=true, finishtime, apaga contenedores
    const { finishtime } = await stopTrainingSession(sessionid, finishedAt);

    // A trophy problem must never break a correct flag: the player did solve the lab
    let trophies = [];
    try {
        trophies = await awardTrophies({
            userid: session.userid,
            labid: session.labid,
            solved: true,
            elapsedSeconds: (new Date(finishedAt) - new Date(session.starttime)) / 1000,
            failedFlags: session.failedflags ?? 0,
        });
    } catch (err) {
        console.error('Award trophies error:', err);
    }

    return { matched: true, finishtime, trophies };
}