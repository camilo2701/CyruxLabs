// Este archivo se encarga de exponer, como endpoint HTTP, la guía de creación
// de laboratorios en formato Markdown que el frontend muestra al usuario.

import { getCreationGuide } from '../services/docsService.js';

// Este controlador se encarga de responder con el Markdown de la guía de creación,
// o con un error 500 si no se pudo cargar el archivo.
export async function getCreationGuideMarkdown(req, res) {
    try {
        const markdown = await getCreationGuide();
        res.json({ markdown });
    } catch (err) {
        console.error('Get creation guide error:', err);
        res.status(500).json({ message: 'No se pudo cargar la guía' });
    }
}