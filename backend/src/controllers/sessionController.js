import { getSessionsForUser, getSessionById, startTrainingSession, restartTrainingSession, stopTrainingSession, submitFlag } from '../services/sessionService.js';

export function assertOwnsSession(session, reqUser) {
    const isOwner = session.userid === reqUser.userid;
    const isStaff = reqUser.role === 1 || reqUser.role === 2;
    if (!isOwner && !isStaff) {
        const err = new Error('No tienes permiso sobre esta sesión');
        err.status = 403;
        throw err;
    }
}

export async function getMySessions(req, res) {
    try {
        const sessions = await getSessionsForUser(req.user.userid);
        return res.status(200).json({ sessions });
    } catch (err) {
        console.error('Error obteniendo historial:', err);
        return res.status(500).json({ error: 'Error interno al obtener el historial' });
    }
}

export async function getSessionsByUserId(req, res) {
    try {
        const { userid } = req.params;
        const sessions = await getSessionsForUser(Number(userid));
        return res.status(200).json({ sessions });
    } catch (err) {
        console.error('Error obteniendo historial:', err);
        return res.status(500).json({ error: 'Error interno al obtener el historial' });
    }
}

export async function getSessionDetails(req, res) {
    try {
        const { sessionid } = req.params;
        const session = await getSessionById(sessionid);
        assertOwnsSession(session, req.user);
        res.json({ session });
    } catch (err) {
        console.error('Get session details error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

export async function postStartSession(req, res) {
    try {
        const { labid } = req.body;
        const userid = req.user.userid;
        const result = await startTrainingSession({ labid, userid });
        res.json(result);
    } catch (err) {
        console.error('Start session error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

export async function postRestartSession(req, res) {
    try {
        const { labid, sessionid } = req.body;
        const session = await getSessionById(sessionid);
        assertOwnsSession(session, req.user);
        const result = await restartTrainingSession({ labid, sessionid });
        res.json(result);
    } catch (err) {
        console.error('Restart session error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

export async function postStopSession(req, res) {
    try {
        const { sessionid } = req.body;
        const session = await getSessionById(sessionid);
        assertOwnsSession(session, req.user);
        await stopTrainingSession(sessionid);
        res.json({ message: 'Session stopped' });
    } catch (err) {
        console.error('Stop session error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

export async function postSubmitFlag(req, res) {
    try {
        const { sessionid, flag } = req.body;
        const session = await getSessionById(sessionid);
        assertOwnsSession(session, req.user);
        const result = await submitFlag(sessionid, flag);
        res.json(result);
    } catch (err) {
        console.error('Submit flag error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}