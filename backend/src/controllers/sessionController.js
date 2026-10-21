import { getSessionsForUser, getSessionById, refreshStartStatus, startTrainingSession, restartTrainingSession, stopTrainingSession, submitFlag } from '../services/sessionService.js';
import { logEvent, fromReq, clientIp } from '../services/logService.js';
import { getSessionReportData, buildSessionReportPdf } from '../services/reportPdfService.js';
import { supabase } from '../config/supabaseClient.js';

// Quién lo hace y desde dónde, para el registro de actividad
const logContextOf = (req) => ({ actor: req.user, ip: clientIp(req) });

// Qué usuarios puede revisar el staff según el rol del dueño:
// instructor → solo estudiantes; admin → estudiantes e instructores.
export function staffCanAccess(reqUser, ownerRole) {
    if (reqUser.role === 2) return ownerRole === 0 || ownerRole === 1;
    if (reqUser.role === 1) return ownerRole === 0;
    return false;
}

// denial (opcional): { action, verb, ip } solo sirve para registrar el intento denegado.
// Otros archivos pueden seguir llamándola con dos argumentos.
export function assertOwnsSession(session, reqUser, denial = null) {
    const isOwner = session.userid === reqUser.userid;
    const isStaff = staffCanAccess(reqUser, session.users?.role);
    if (!isOwner && !isStaff) {
        if (denial) {
            logEvent({
                actor: reqUser,
                ip: denial.ip,
                action: denial.action,
                facility: 'session',
                event: 'SESSION_ACCESS_DENIED',
                severity: 'warning',
                targetid: session.sessionid,
                description: `Intentó ${denial.verb} la sesión #${session.sessionid} de otro usuario`,
            });
        }
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
        const userid = Number(req.params.userid);
        if (!Number.isInteger(userid) || userid <= 0) {
            return res.status(400).json({ error: 'ID de usuario inválido' });
        }

        if (userid !== req.user.userid) {
            const { data: target, error: targetError } = await supabase
                .from('users')
                .select('role')
                .eq('userid', userid)
                .maybeSingle();

            if (targetError) throw targetError;
            if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

            if (!staffCanAccess(req.user, target.role)) {
                logEvent({
                    ...fromReq(req),
                    action: 'READ',
                    facility: 'session',
                    event: 'SESSIONS_VIEW_DENIED',
                    severity: 'warning',
                    targetid: userid,
                    description: `Intentó consultar el historial de sesiones del usuario #${userid} sin permiso`,
                });
                return res.status(403).json({ error: 'No tienes permiso para ver el historial de este usuario' });
            }
        }

        const sessions = await getSessionsForUser(userid);

        // Mirar la actividad de una persona concreta no es un listado rutinario: se registra
        if (userid !== req.user.userid) {
            logEvent({
                ...fromReq(req),
                action: 'READ',
                facility: 'session',
                event: 'SESSIONS_VIEWED',
                targetid: userid,
                description: `Consultó el historial de sesiones del usuario #${userid}`,
            });
        }

        return res.status(200).json({ sessions });
    } catch (err) {
        console.error('Error obteniendo historial:', err);
        return res.status(500).json({ error: 'Error interno al obtener el historial' });
    }
}

// Also the endpoint the loading dialog polls while a lab is starting:
// refreshStartStatus asks the runner and brings startstatus / startphase up to date.
export async function getSessionDetails(req, res) {
    try {
        const { sessionid } = req.params;
        const session = await getSessionById(sessionid);
        assertOwnsSession(session, req.user, { action: 'READ', verb: 'ver', ip: clientIp(req) });
        const fresh = await refreshStartStatus(session, logContextOf(req));
        res.json({ session: fresh });
    } catch (err) {
        console.error('Get session details error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

export async function postStartSession(req, res) {
    try {
        const { labid } = req.body;
        const userid = req.user.userid;
        const result = await startTrainingSession({ labid, userid, ...logContextOf(req) });
        res.json(result);
    } catch (err) {
        console.error('Start session error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

export async function postRestartSession(req, res) {
    try {
        const { sessionid } = req.body;
        const session = await getSessionById(sessionid);
        assertOwnsSession(session, req.user, { action: 'UPDATE', verb: 'reiniciar', ip: clientIp(req) });

        // El lab sale de la propia sesión, no del cuerpo de la petición: así no se puede
        // lanzar otro laboratorio bajo esta sesión
        const result = await restartTrainingSession({
            labid: session.labid,
            sessionid,
            ...logContextOf(req),
        });
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
        assertOwnsSession(session, req.user, { action: 'UPDATE', verb: 'cerrar', ip: clientIp(req) });
        const { finishtime, trophies } = await stopTrainingSession(sessionid, undefined, logContextOf(req));
        res.json({ message: 'Session stopped', finishtime, trophies });
    } catch (err) {
        console.error('Stop session error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

export async function postSubmitFlag(req, res) {
    try {
        const { sessionid, flag } = req.body;

        if (typeof flag !== 'string') {
            return res.status(400).json({ message: 'Flag inválida' });
        }

        const session = await getSessionById(sessionid);
        assertOwnsSession(session, req.user, { action: 'UPDATE', verb: 'enviar una flag en', ip: clientIp(req) });
        const result = await submitFlag(sessionid, flag, logContextOf(req));
        res.json(result);
    } catch (err) {
        console.error('Submit flag error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

// pdf con el reporte
export async function getSessionReport(req, res) {
    try {
        const { sessionid } = req.params;
        const session = await getSessionById(sessionid);
        assertOwnsSession(session, req.user, { action: 'READ', verb: 'descargar el reporte de', ip: clientIp(req) });

        const data = await getSessionReportData(sessionid);
        const pdf = await buildSessionReportPdf(data);
        const filename = `reporte-sesion-${data.session.sessionid}-${data.user?.username ?? 'usuario'}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdf);
    } catch (err) {
        console.error('Session report error:', err);
        res.status(err.status || 500).json({ message: err.status ? err.message : 'No se pudo generar el reporte' });
    }
}
