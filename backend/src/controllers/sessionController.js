import { getSessionsForUser, startTrainingSession, stopTrainingSession } from '../services/sessionService.js';

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

export async function postStartSession(req, res) {
    try {
        const { labid, userid } = req.body;
        const result = await startTrainingSession({ labid, userid });
        res.json(result);
    } catch (err) {
        console.error('Start session error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

export async function postStopSession(req, res) {
    try {
        const { sessionid } = req.body;
        await stopTrainingSession(sessionid);
        res.json({ message: 'Session stopped' });
    } catch (err) {
        console.error('Stop session error:', err);
        res.status(500).json({ message: err.message, error: err.details || err.message });
    }
}