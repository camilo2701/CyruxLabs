import { getLogs, LOG_ACTIONS, LOG_FACILITIES, LOG_SEVERITIES } from '../services/logService.js';

const FILTER_VALUES = { facility: LOG_FACILITIES, action: LOG_ACTIONS, severity: LOG_SEVERITIES };

// ADMIN ONLY (protegido en la ruta). No se registra que alguien abra el log.
export const listLogs = async (req, res) => {
    try {
        const { before } = req.query;

        const cursor = before === undefined ? null : Number(before);
        if (cursor !== null && (!Number.isInteger(cursor) || cursor <= 0)) {
            return res.status(400).json({ message: 'Cursor inválido' });
        }

        for (const [name, allowed] of Object.entries(FILTER_VALUES)) {
            const value = req.query[name];
            if (value !== undefined && !allowed.includes(value)) {
                return res.status(400).json({ message: `Filtro inválido: ${name}` });
            }
        }

        const { facility, action, severity } = req.query;
        res.json(await getLogs({ before: cursor, facility, action, severity }));
    } catch (error) {
        console.error('List logs error:', error);
        res.status(500).json({ message: 'Failed to fetch logs', error: error.message });
    }
};