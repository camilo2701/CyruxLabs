import { getSessionById } from '../services/sessionService.js';
import {
    createBugReport,
    getPendingBugCounts,
    getReportsForLab,
    updateReportStatus,
} from '../services/bugReportService.js';
import { assertOwnsSession } from './sessionController.js';

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 2000;

export async function postBugReport(req, res) {
    try {
        const { sessionid, title, description } = req.body;

        const cleanTitle = typeof title === 'string' ? title.trim() : '';
        const cleanDescription = typeof description === 'string' ? description.trim() : '';

        if (!sessionid || !cleanTitle || !cleanDescription) {
            return res.status(400).json({ message: 'Faltan datos del reporte' });
        }

        if (cleanTitle.length > TITLE_MAX || cleanDescription.length > DESCRIPTION_MAX) {
            return res.status(400).json({ message: 'El reporte excede el largo permitido' });
        }

        const session = await getSessionById(sessionid);
        assertOwnsSession(session, req.user);

        const result = await createBugReport({
            title: cleanTitle,
            description: cleanDescription,
            userid: req.user.userid,
            labid: session.labid,
        });

        res.status(201).json(result);
    } catch (err) {
        console.error('Bug report error:', err);
        res.status(err.status || 500).json({ message: err.message, error: err.details || err.message });
    }
}

export async function getBugCounts(req, res) {
    try {
        const labIds = String(req.query.labids || '')
            .split(',')
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
            .slice(0, 50);

        const ownerId = req.user.role === 2 ? null : req.user.userid;
        const counts = await getPendingBugCounts(labIds, ownerId);
        res.json({ counts });
    } catch (err) {
        console.error('Bug counts error:', err);
        res.status(500).json({ message: 'No se pudieron obtener los reportes de bugs' });
    }
}

// GET /api/bugreports/lab/:labid  (instructor: solo sus labs / admin: todos)
export async function getLabBugReports(req, res) {
    try {
        const reports = await getReportsForLab(Number(req.params.labid), req.user);
        res.json({ reports });
    } catch (err) {
        if (!err.status) console.error('Get lab bug reports error:', err);
        res.status(err.status || 500).json({ message: err.status ? err.message : 'No se pudieron obtener los reportes' });
    }
}

// PATCH /api/bugreports/:bugreportid/status  body: { status: 0 | 1 }
export async function patchBugReportStatus(req, res) {
    try {
        const result = await updateReportStatus(Number(req.params.bugreportid), req.body?.status, req.user);
        res.json(result);
    } catch (err) {
        if (!err.status) console.error('Update bug report status error:', err);
        res.status(err.status || 500).json({ message: err.status ? err.message : 'No se pudo actualizar el reporte' });
    }
}
