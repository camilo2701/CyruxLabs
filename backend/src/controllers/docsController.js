import { getCreationGuide } from '../services/docsService.js';

export async function getCreationGuideMarkdown(req, res) {
    try {
        const markdown = await getCreationGuide();
        res.json({ markdown });
    } catch (err) {
        console.error('Get creation guide error:', err);
        res.status(500).json({ message: 'No se pudo cargar la guía' });
    }
}