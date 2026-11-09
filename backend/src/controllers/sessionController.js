// Este archivo se encarga de los controladores HTTP de las sesiones de laboratorio: iniciar, reiniciar, detener, enviar flag, consultar historial y descargar el reporte.
import { getSessionsForUser, getSessionById, getSessionTrophies, refreshStartStatus, startTrainingSession, restartTrainingSession, stopTrainingSession, submitFlag } from '../services/sessionService.js';
import { logEvent, fromReq, clientIp } from '../services/logService.js';
import { getSessionReportData, buildSessionReportPdf } from '../services/reportPdfService.js';
import { supabase } from '../config/supabaseClient.js';

// Quién lo hace y desde dónde, para el registro de actividad
// Esta constante se encarga de armar el contexto (actor e IP) que acompaña a los logs de la petición.
const logContextOf = (req) => ({ actor: req.user, ip: clientIp(req) });

// instructor solo estudiantes, admin cualquier rol
// Esta función se encarga de decidir si un miembro del staff puede acceder a datos según su rol y el del dueño.
export function staffCanAccess(reqUser, ownerRole) {
    if (reqUser.role === 2) return ownerRole === 0 || ownerRole === 1 || ownerRole === 2;
    if (reqUser.role === 1) return ownerRole === 0;
    return false;
}

// denial (opcional): { action, verb, ip } solo sirve para registrar el intento denegado.
// Otros archivos pueden seguir llamándola con dos argumentos.
// Esta función se encarga de verificar que el usuario sea dueño de la sesión (o staff autorizado); si no, registra el intento y lanza 403.
export function assertOwnsSession(session, reqUser, denial = null) {
    const isOwner = session.userid === reqUser.userid;
    const isStaff = staffCanAccess(reqUser, session.users?.role);
    // Validación: si no es dueño ni staff, opcionalmente deja constancia del acceso denegado y corta con error 403.
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

// Este controlador se encarga de devolver el historial de sesiones del usuario autenticado.
export async function getMySessions(req, res) {
    try {
        const sessions = await getSessionsForUser(req.user.userid);
        return res.status(200).json({ sessions });
    } catch (err) {
        console.error('Error obteniendo historial:', err);
        return res.status(500).json({ error: 'Error interno al obtener el historial' });
    }
}

// Este controlador se encarga de devolver el historial de sesiones de otro usuario, validando permisos de staff y registrando el acceso.
export async function getSessionsByUserId(req, res) {
    try {
        // Validación: el ID de usuario debe ser un entero positivo.
        const userid = Number(req.params.userid);
        if (!Number.isInteger(userid) || userid <= 0) {
            return res.status(400).json({ error: 'ID de usuario inválido' });
        }

        // Si se pide el historial de otra persona, hay que comprobar permisos de staff.
        if (userid !== req.user.userid) {
            // Consulta a Supabase el rol del usuario objetivo para decidir el acceso.
            const { data: target, error: targetError } = await supabase
                .from('users')
                .select('role')
                .eq('userid', userid)
                .maybeSingle();

            if (targetError) throw targetError;
            if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

            // Sin permiso de staff: registra el intento denegado y responde 403.
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
// Este controlador se encarga de devolver el detalle de una sesión, actualizando su estado de arranque y sus trofeos si ya terminó.
export async function getSessionDetails(req, res) {
    try {
        const { sessionid } = req.params;
        const session = await getSessionById(sessionid);
        assertOwnsSession(session, req.user, { action: 'READ', verb: 'ver', ip: clientIp(req) });
        const fresh = await refreshStartStatus(session, logContextOf(req));

        // Once the session has ended it also says what it unlocked: the page needs it when the
        // session was closed without the student asking (for example by a lab update)
        const trophies = fresh.iscompleted ? await getSessionTrophies(sessionid) : [];

        res.json({ session: { ...fresh, trophies } });
    } catch (err) {
        console.error('Get session details error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

// Este controlador se encarga de iniciar una nueva sesión de entrenamiento sobre el laboratorio indicado.
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

// Este controlador se encarga de reiniciar una sesión existente del propio usuario.
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

// Este controlador se encarga de detener una sesión y devolver su hora de término, trofeos y XP obtenida.
export async function postStopSession(req, res) {
    try {
        const { sessionid } = req.body;
        const session = await getSessionById(sessionid);
        assertOwnsSession(session, req.user, { action: 'UPDATE', verb: 'cerrar', ip: clientIp(req) });
        // xp: what the session gave (trophies can give XP even when the lab was not solved)
        const { finishtime, trophies, xp } = await stopTrainingSession(sessionid, undefined, logContextOf(req));
        res.json({ message: 'Session stopped', finishtime, trophies, xp });
    } catch (err) {
        console.error('Stop session error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

// Este controlador se encarga de recibir y validar el envío de una flag para una sesión del usuario.
export async function postSubmitFlag(req, res) {
    try {
        const { sessionid, flag } = req.body;

        // Validación: la flag debe ser una cadena de texto.
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
// Este controlador se encarga de generar y enviar como descarga el PDF del reporte de una sesión.
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
