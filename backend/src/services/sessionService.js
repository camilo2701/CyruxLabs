import { supabase } from '../config/supabaseClient.js';

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
        .select('sessionid, userid, labid, iscompleted, issolved, port, protocol, starttime, finishtime, lab(title)')
        .eq('sessionid', sessionid)
        .single();

    if (error || !data) {
        const err = new Error('Sesión no encontrada');
        err.status = 404;
        throw err;
    }

    return data;
}

const RUNNER_URL = 'http://10.10.0.11:4000';

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

    const { error: updateError } = await supabase
        .from('session')
        .update({ port: runnerResult.port, protocol: runnerResult.protocol, starttime })
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

export async function stopTrainingSession(sessionid) {
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

    const now = new Date();
    const { error: updateError } = await supabase
        .from('session')
        .update({ iscompleted: true, finishtime: now.toISOString() })
        .eq('sessionid', sessionid)
        .eq('iscompleted', false);

    if (updateError) console.error('Session update error:', updateError);
}

export async function submitFlag(sessionid, submittedFlag) {
    const { data: session, error: sessionError } = await supabase
        .from('session')
        .select('sessionid, labid, iscompleted, lab(flag)')
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
        return { matched: false };
    }

    const { error: updateError } = await supabase
        .from('session')
        .update({ capturedflag: submittedFlag.trim(), issolved: true })
        .eq('sessionid', sessionid);

    if (updateError) console.error('Capturedflag update error:', updateError);

    await stopTrainingSession(sessionid); // marca iscompleted=true, finishtime, apaga contenedores

    return { matched: true };
}