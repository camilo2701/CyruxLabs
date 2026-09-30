import { getSessionById } from '../services/sessionService.js';
import { createBugReport } from '../services/bugReportService.js';
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