// Este archivo se encarga de atender la petición HTTP para listar el registro de actividad, validando el cursor y los filtros.
import { getLogs, LOG_ACTIONS, LOG_FACILITIES, LOG_SEVERITIES } from '../services/logService.js';

// Esta constante se encarga de mapear cada filtro con el conjunto de valores válidos que admite.
const FILTER_VALUES = { facility: LOG_FACILITIES, action: LOG_ACTIONS, severity: LOG_SEVERITIES };

// ADMIN ONLY (protegido en la ruta). No se registra que alguien abra el log.
// Este controlador se encarga de devolver una página de logs aplicando el cursor y los filtros recibidos.
export const listLogs = async (req, res) => {
    try {
        const { before } = req.query;

        // Validación: el cursor "before" debe ser un entero positivo o no venir.
        const cursor = before === undefined ? null : Number(before);
        if (cursor !== null && (!Number.isInteger(cursor) || cursor <= 0)) {
            return res.status(400).json({ message: 'Cursor inválido' });
        }

        // Validación: rechaza cualquier filtro con un valor fuera de los permitidos.
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